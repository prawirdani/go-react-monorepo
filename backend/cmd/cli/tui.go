package main

import (
	"context"
	"fmt"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/prawirdani/go-react-monorepo/config"
)

// screen identifies the active TUI screen.
type screen int

const (
	screenMenu screen = iota
	screenDatabase
	screenBackups
	screenUsers
	screenSystem
)

// dbMode is the Database screen's input state.
type dbMode int

const (
	dbModeList dbMode = iota
	dbModeConfirmDown
	dbModeCreateName
)

// userMode is the Users screen's input state.
type userMode int

const (
	userModeList userMode = iota
	userModeForm
)

// menuItem is one main-menu entry.
type menuItem struct {
	title  string
	screen screen
}

var menuItems = []menuItem{
	{title: "Database", screen: screenDatabase},
	{title: "Backups", screen: screenBackups},
	{title: "Users", screen: screenUsers},
	{title: "System", screen: screenSystem},
}

var (
	databaseActions = []string{"refresh status", "up", "down", "create migration"}
	backupActions   = []string{"run backup now", "list 10 newest", "validate config"}
	userActions     = []string{"create admin", "list admins"}
	systemActions   = []string{"run diagnostics", "sync permission catalog"}
)

// createAdminLabels are the four create-admin form prompts, in order.
var createAdminLabels = [4]string{
	"Name: ",
	"Email: ",
	"Password (8-72 bytes): ",
	"Confirm password: ",
}

// createAdminForm tracks the create-admin field sequence.
type createAdminForm struct {
	step    int
	values  [4]string
	errText string
}

// progressLog collects backup phase lines off the UI goroutine.
type progressLog struct {
	mu    sync.Mutex
	lines []string
}

func (p *progressLog) add(msg string) {
	if msg == "" {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if n := len(p.lines); n > 0 && p.lines[n-1] == msg {
		return
	}
	p.lines = append(p.lines, msg)
}

func (p *progressLog) snapshot() []string {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]string, len(p.lines))
	copy(out, p.lines)
	return out
}

// model is the whole TUI state. Only Update writes it.
type model struct {
	ctx  context.Context
	cfg  *config.Config
	v    string // app version, read once
	scr  screen
	menu int

	width  int
	height int

	busy    bool
	spinner spinner.Model

	notice  string
	errText string

	// Database
	dbMode         dbMode
	dbCursor       int
	migrations     []MigrationRow
	migrationsDone bool
	downSteps      int
	input          textinput.Model

	// Backups
	backupCursor  int
	backupObjects []backupRow
	backupsDone   bool
	backupKey     string
	progress      *progressLog

	// Users
	userMode   userMode
	userCursor int
	admins     []AdminRow
	adminsDone bool
	adminForm  createAdminForm

	// System
	systemCursor int
	checks       []Check
	syncOutput   string
}

// backupRow is one listed backup, flattened for the view layer.
type backupRow struct {
	Key          string
	Size         int64
	LastModified time.Time
}

// Async messages. Long actions run in a Cmd goroutine and return one of these;
// the UI goroutine is the only writer of model state.
type (
	migrationsMsg struct {
		rows []MigrationRow
		err  error
	}
	backupDoneMsg struct {
		key string
		err error
	}
	backupListMsg struct {
		objects []backupRow
		err     error
	}
	adminsMsg struct {
		rows []AdminRow
		err  error
	}
	diagnoseMsg struct {
		checks []Check
	}
	syncMsg struct {
		output string
		err    error
	}
	actionMsg struct {
		label  string
		detail string
		err    error
	}
	tickMsg struct{}
)

// runTUI starts the interactive menu. A config error does not abort: the menu
// still opens and the System screen reports it.
func runTUI(ctx context.Context) error {
	cfg, cfgErr := config.LoadConfig()

	m := newModel(ctx, cfg)
	if cfgErr != nil {
		m.errText = "config: " + cfgErr.Error()
	}

	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

// newModel builds the initial menu model. cfg may be nil.
func newModel(ctx context.Context, cfg *config.Config) model {
	sp := spinner.New(spinner.WithSpinner(spinner.Dot))

	in := textinput.New()
	in.CharLimit = 254
	in.Prompt = ""

	return model{
		ctx:       ctx,
		cfg:       cfg,
		v:         appVersion(),
		scr:       screenMenu,
		width:     80,
		height:    24,
		spinner:   sp,
		downSteps: 1,
		input:     in,
		progress:  &progressLog{},
	}
}

// appVersion mirrors printVersion: APP_VERSION, falling back to "dev".
func appVersion() string {
	var app config.App
	if err := app.Parse(); err == nil && app.Version != "" {
		return app.Version
	}
	return "dev"
}

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil

	case spinner.TickMsg:
		if !m.busy {
			return m, nil
		}
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tickMsg:
		if !m.busy {
			return m, nil
		}
		return m, m.tick()

	case tea.KeyMsg:
		return m.updateKey(msg)

	case migrationsMsg:
		m.busy = false
		if msg.err != nil {
			m.errText = msg.err.Error()
			return m, nil
		}
		m.migrations = msg.rows
		m.migrationsDone = true
		m.errText = ""
		return m, nil

	case backupDoneMsg:
		m.busy = false
		if msg.err != nil {
			m.errText = msg.err.Error()
			return m, nil
		}
		m.backupKey = msg.key
		m.notice = "backup written: " + msg.key
		m.errText = ""
		return m, nil

	case backupListMsg:
		m.busy = false
		if msg.err != nil {
			m.errText = msg.err.Error()
			return m, nil
		}
		m.backupObjects = msg.objects
		m.backupsDone = true
		m.errText = ""
		return m, nil

	case adminsMsg:
		m.busy = false
		if msg.err != nil {
			m.errText = msg.err.Error()
			return m, nil
		}
		m.admins = msg.rows
		m.adminsDone = true
		m.errText = ""
		return m, nil

	case diagnoseMsg:
		m.busy = false
		m.checks = msg.checks
		m.errText = ""
		return m, nil

	case syncMsg:
		m.busy = false
		m.syncOutput = msg.output
		if msg.err != nil {
			m.errText = msg.err.Error()
			return m, nil
		}
		m.notice = "permission catalog synced"
		m.errText = ""
		return m, nil

	case actionMsg:
		m.busy = false
		if msg.err != nil {
			m.errText = msg.label + ": " + msg.err.Error()
			return m, nil
		}
		m.notice = msg.label + ": " + msg.detail
		m.errText = ""
		return m, nil
	}

	return m, nil
}

// updateKey handles keyboard input. While an action runs only ctrl+c works, so
// the UI can never start a second action on the same state.
func (m model) updateKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.String() == "ctrl+c" {
		return m, tea.Quit
	}
	if m.busy {
		return m, nil
	}

	switch m.scr {
	case screenMenu:
		switch msg.String() {
		case "up", "k":
			m.menu = wrapCursor(m.menu, -1, len(menuItems))
		case "down", "j":
			m.menu = wrapCursor(m.menu, 1, len(menuItems))
		case "enter":
			return m.openScreen(menuItems[m.menu].screen)
		case "esc", "q":
			return m, tea.Quit
		}

	case screenDatabase:
		return m.updateDatabase(msg)

	case screenBackups:
		return m.updateBackups(msg)

	case screenUsers:
		return m.updateUsers(msg)

	case screenSystem:
		return m.updateSystem(msg)
	}

	return m, nil
}

// openScreen switches screens and loads whatever the new screen shows.
func (m model) openScreen(target screen) (tea.Model, tea.Cmd) {
	m.scr = target
	m.notice, m.errText = "", ""
	m.backupKey = ""

	switch target {
	case screenDatabase:
		m.dbMode = dbModeList
		m.dbCursor = 0
		next, cmd := m.startMigrations()
		return next, cmd

	case screenBackups:
		m.backupCursor = 0
		return m, nil

	case screenUsers:
		m.userMode = userModeList
		m.userCursor = 0
		m.input.Blur()
		m.input.SetValue("")
		m.input.EchoMode = textinput.EchoNormal
		return m, nil

	case screenSystem:
		m.systemCursor = 0
		return m, nil

	case screenMenu:
		return m, nil
	}

	return m, nil
}

// goMenu returns to the main menu.
func (m model) goMenu() (tea.Model, tea.Cmd) {
	m.scr = screenMenu
	m.dbMode = dbModeList
	m.userMode = userModeList
	m.input.Blur()
	m.input.SetValue("")
	m.input.EchoMode = textinput.EchoNormal
	m.adminForm = createAdminForm{}
	m.errText = ""
	return m, nil
}

// wrapCursor moves an index inside [0,n) and wraps at both ends.
func wrapCursor(cursor, delta, n int) int {
	if n <= 0 {
		return 0
	}
	return (cursor + delta + n) % n
}

// tick schedules a progress refresh while an action runs.
func (m model) tick() tea.Cmd {
	return tea.Tick(150*time.Millisecond, func(time.Time) tea.Msg { return tickMsg{} })
}

// startMigrations loads the migration status.
func (m model) startMigrations() (model, tea.Cmd) {
	if m.cfg == nil {
		m.errText = "config is not loaded"
		return m, nil
	}
	m.busy = true
	ctx, cfg := m.ctx, m.cfg
	return m, tea.Batch(func() tea.Msg {
		rows, err := migrationStatuses(ctx, cfg)
		return migrationsMsg{rows: rows, err: err}
	}, m.spinner.Tick, m.tick())
}

// updateDatabase handles the Database screen.
func (m model) updateDatabase(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch m.dbMode {
	case dbModeConfirmDown:
		switch msg.String() {
		case "y":
			m.dbMode = dbModeList
			m.busy = true
			ctx, cfg := m.ctx, m.cfg
			steps := m.downSteps
			return m, tea.Batch(func() tea.Msg {
				return actionMsg{
					label:  fmt.Sprintf("down %d", steps),
					detail: "rolled back",
					err:    runMigrations(ctx, cfg, "down", steps),
				}
			}, m.spinner.Tick, m.tick())
		case "enter", "n", "esc":
			m.dbMode = dbModeList
			m.notice = "rollback cancelled"
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			m.downSteps = int(msg.String()[0] - '0')
		}
		return m, nil

	case dbModeCreateName:
		switch msg.String() {
		case "esc":
			m.dbMode = dbModeList
			m.input.Blur()
			m.input.SetValue("")
		case "enter":
			name := strings.TrimSpace(m.input.Value())
			if name == "" {
				m.errText = "migration name is required"
				return m, nil
			}
			m.dbMode = dbModeList
			m.input.Blur()
			m.input.SetValue("")
			m.busy = true
			return m, tea.Batch(func() tea.Msg {
				path, err := createMigration(name, defaultMigrationsDir)
				return actionMsg{label: "create migration", detail: path, err: err}
			}, m.spinner.Tick, m.tick())
		default:
			var cmd tea.Cmd
			m.input, cmd = m.input.Update(msg)
			return m, cmd
		}
		return m, nil

	case dbModeList:
		// The action list below handles the default state.
	}

	switch msg.String() {
	case "esc":
		return m.goMenu()
	case "up", "k":
		m.dbCursor = wrapCursor(m.dbCursor, -1, len(databaseActions))
	case "down", "j":
		m.dbCursor = wrapCursor(m.dbCursor, 1, len(databaseActions))
	case "enter":
		switch m.dbCursor {
		case 0:
			next, cmd := m.startMigrations()
			return next, cmd
		case 1:
			m.busy = true
			ctx, cfg := m.ctx, m.cfg
			return m, tea.Batch(func() tea.Msg {
				return actionMsg{label: "up", detail: "migrations applied", err: runMigrations(ctx, cfg, "up", 0)}
			}, m.spinner.Tick, m.tick())
		case 2:
			m.dbMode = dbModeConfirmDown
			m.downSteps = 1
		case 3:
			m.dbMode = dbModeCreateName
			m.input.SetValue("")
			m.input.EchoMode = textinput.EchoNormal
			m.input.Focus()
			m.errText = ""
		}
	}
	return m, nil
}

// updateBackups handles the Backups screen.
func (m model) updateBackups(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		return m.goMenu()
	case "up", "k":
		m.backupCursor = wrapCursor(m.backupCursor, -1, len(backupActions))
	case "down", "j":
		m.backupCursor = wrapCursor(m.backupCursor, 1, len(backupActions))
	case "enter":
		switch m.backupCursor {
		case 0:
			if m.cfg == nil {
				m.errText = "config is not loaded"
				return m, nil
			}
			log := &progressLog{}
			m.progress = log
			m.busy = true
			m.notice, m.errText, m.backupKey = "", "", ""
			ctx, cfg := m.ctx, m.cfg
			return m, tea.Batch(func() tea.Msg {
				key, err := runBackupOnce(ctx, cfg, log.add)
				return backupDoneMsg{key: key, err: err}
			}, m.spinner.Tick, m.tick())
		case 1:
			if m.cfg == nil {
				m.errText = "config is not loaded"
				return m, nil
			}
			m.busy = true
			m.errText = ""
			ctx, cfg := m.ctx, m.cfg
			return m, tea.Batch(func() tea.Msg {
				objects, err := listBackupObjects(ctx, cfg, 10)
				rows := make([]backupRow, 0, len(objects))
				for _, o := range objects {
					rows = append(rows, backupRow(o))
				}
				return backupListMsg{objects: rows, err: err}
			}, m.spinner.Tick, m.tick())
		case 2:
			if m.cfg == nil {
				m.errText = "config is not loaded"
				return m, nil
			}
			if err := validateBackupConfig(m.cfg); err != nil {
				m.errText = "backup config: " + err.Error()
				return m, nil
			}
			m.notice = "backup config: valid"
			m.errText = ""
		}
	}
	return m, nil
}

// updateUsers handles the Users screen, including the create-admin form.
func (m model) updateUsers(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if m.userMode == userModeForm {
		switch msg.String() {
		case "esc":
			m.userMode = userModeList
			m.adminForm = createAdminForm{}
			m.input.Blur()
			m.input.SetValue("")
			m.input.EchoMode = textinput.EchoNormal
			return m, nil
		case "enter":
			return m.advanceAdminForm()
		}
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}

	switch msg.String() {
	case "esc":
		return m.goMenu()
	case "up", "k":
		m.userCursor = wrapCursor(m.userCursor, -1, len(userActions))
	case "down", "j":
		m.userCursor = wrapCursor(m.userCursor, 1, len(userActions))
	case "enter":
		switch m.userCursor {
		case 0:
			m.userMode = userModeForm
			m.adminForm = createAdminForm{}
			m.input.SetValue("")
			m.input.EchoMode = textinput.EchoNormal
			m.input.Focus()
			m.errText, m.notice = "", ""
		case 1:
			if m.cfg == nil {
				m.errText = "config is not loaded"
				return m, nil
			}
			m.busy = true
			m.errText = ""
			ctx, cfg := m.ctx, m.cfg
			return m, tea.Batch(func() tea.Msg {
				rows, err := listAdmins(ctx, cfg)
				return adminsMsg{rows: rows, err: err}
			}, m.spinner.Tick, m.tick())
		}
	}
	return m, nil
}

// advanceAdminForm validates the current field and either moves on or submits.
func (m model) advanceAdminForm() (tea.Model, tea.Cmd) {
	value := m.input.Value()

	switch m.adminForm.step {
	case 0:
		name := strings.TrimSpace(value)
		if name == "" {
			m.adminForm.errText = "name is required"
			return m, nil
		}
		m.adminForm.values[0] = name
	case 1:
		email := strings.TrimSpace(value)
		if _, err := mail.ParseAddress(email); err != nil {
			m.adminForm.errText = "enter a valid email address"
			return m, nil
		}
		m.adminForm.values[1] = email
	case 2:
		// bcrypt truncates past 72 bytes; mirror the auth model's min=8,max=72.
		if n := len(value); n < 8 || n > 72 {
			m.adminForm.errText = fmt.Sprintf("password must be 8-72 bytes, got %d", n)
			return m, nil
		}
		m.adminForm.values[2] = value
	case 3:
		if value != m.adminForm.values[2] {
			m.adminForm.errText = "passwords do not match"
			return m, nil
		}
		name := m.adminForm.values[0]
		email := m.adminForm.values[1]
		password := m.adminForm.values[2]
		m.adminForm = createAdminForm{}
		m.input.SetValue("")
		m.input.EchoMode = textinput.EchoNormal
		m.input.Blur()
		m.userMode = userModeList
		if m.cfg == nil {
			m.errText = "config is not loaded"
			return m, nil
		}
		m.busy = true
		m.errText = ""
		ctx, cfg := m.ctx, m.cfg
		return m, tea.Batch(func() tea.Msg {
			return actionMsg{
				label:  "create admin",
				detail: email,
				err:    createAdminUser(ctx, cfg, name, email, password),
			}
		}, m.spinner.Tick, m.tick())
	}

	m.adminForm.step++
	m.adminForm.errText = ""
	m.input.SetValue("")
	if m.adminForm.step >= 2 {
		m.input.EchoMode = textinput.EchoPassword
	} else {
		m.input.EchoMode = textinput.EchoNormal
	}
	m.input.Focus()
	return m, nil
}

// updateSystem handles the System screen.
func (m model) updateSystem(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		return m.goMenu()
	case "up", "k":
		m.systemCursor = wrapCursor(m.systemCursor, -1, len(systemActions))
	case "down", "j":
		m.systemCursor = wrapCursor(m.systemCursor, 1, len(systemActions))
	case "enter":
		m.busy = true
		m.errText = ""
		ctx, cfg := m.ctx, m.cfg
		switch m.systemCursor {
		case 0:
			return m, tea.Batch(func() tea.Msg {
				return diagnoseMsg{checks: diagnose(ctx, cfg)}
			}, m.spinner.Tick, m.tick())
		case 1:
			return m, tea.Batch(func() tea.Msg {
				out, err := syncPermissions(ctx)
				return syncMsg{output: out, err: err}
			}, m.spinner.Tick, m.tick())
		}
		m.busy = false
	}
	return m, nil
}

func (m model) View() string {
	switch m.scr {
	case screenDatabase:
		return m.databaseView()
	case screenBackups:
		return m.backupsView()
	case screenUsers:
		return m.usersView()
	case screenSystem:
		return m.systemView()
	default:
		return m.menuView()
	}
}
