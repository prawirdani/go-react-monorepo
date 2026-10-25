package main

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// keyMsg builds the KeyMsg a real terminal would send for one key.
func keyMsg(k string) tea.KeyMsg {
	switch k {
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	case "esc":
		return tea.KeyMsg{Type: tea.KeyEsc}
	case "up":
		return tea.KeyMsg{Type: tea.KeyUp}
	case "down":
		return tea.KeyMsg{Type: tea.KeyDown}
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(k)}
	}
}

// press sends one key and returns the model plus the command it produced.
func press(t *testing.T, m model, k string) (model, tea.Cmd) {
	t.Helper()
	next, cmd := m.Update(keyMsg(k))
	got, ok := next.(model)
	require.True(t, ok, "Update returned %T, want model", next)
	return got, cmd
}

// typeText sends one rune at a time, as a terminal would.
func typeText(t *testing.T, m model, text string) model {
	t.Helper()
	for _, r := range text {
		m, _ = press(t, m, string(r))
	}
	return m
}

// isQuit reports whether cmd is tea.Quit.
func isQuit(cmd tea.Cmd) bool {
	if cmd == nil {
		return false
	}
	_, ok := cmd().(tea.QuitMsg)
	return ok
}

func newTestModel() model {
	return newModel(context.Background(), nil)
}

func TestMenuSelectionOpensScreen(t *testing.T) {
	for i, item := range menuItems {
		t.Run(item.title, func(t *testing.T) {
			m := newTestModel()
			m.menu = i

			next, _ := press(t, m, "enter")
			assert.Equal(t, item.screen, next.scr)
		})
	}
}

func TestEscReturnsToMenu(t *testing.T) {
	for _, target := range []screen{screenDatabase, screenBackups, screenUsers, screenSystem} {
		m := newTestModel()
		m.scr = target

		next, cmd := press(t, m, "esc")
		assert.Equal(t, screenMenu, next.scr)
		assert.Nil(t, cmd)
	}
}

func TestMenuQuits(t *testing.T) {
	for _, k := range []string{"esc", "q"} {
		t.Run(k, func(t *testing.T) {
			m := newTestModel()

			_, cmd := press(t, m, k)
			assert.True(t, isQuit(cmd), "%q at the menu must quit", k)
		})
	}
}

func TestDownConfirmRequiresConfirmation(t *testing.T) {
	for _, k := range []string{"n", "enter"} {
		t.Run(k+" cancels", func(t *testing.T) {
			m := newTestModel()
			m.scr = screenDatabase
			m.dbMode = dbModeConfirmDown
			m.downSteps = 1

			next, cmd := press(t, m, k)
			assert.Equal(t, dbModeList, next.dbMode)
			assert.False(t, next.busy, "a rejected confirm must not start a rollback")
			assert.Nil(t, cmd)
		})
	}

	t.Run("digit sets steps", func(t *testing.T) {
		m := newTestModel()
		m.scr = screenDatabase
		m.dbMode = dbModeConfirmDown

		next, cmd := press(t, m, "3")
		assert.Equal(t, 3, next.downSteps)
		assert.Nil(t, cmd)
	})

	t.Run("y confirms", func(t *testing.T) {
		m := newTestModel()
		m.scr = screenDatabase
		m.dbMode = dbModeConfirmDown
		m.downSteps = 1

		next, cmd := press(t, m, "y")
		assert.Equal(t, dbModeList, next.dbMode)
		assert.True(t, next.busy)
		assert.NotNil(t, cmd)
	})
}

// openAdminForm drives the menus into the create-admin form.
func openAdminForm(t *testing.T, m model) model {
	t.Helper()
	m.scr = screenUsers
	m.userCursor = 0

	m, _ = press(t, m, "enter")
	require.Equal(t, userModeForm, m.userMode)
	return m
}

func TestCreateAdminFormShortPassword(t *testing.T) {
	m := openAdminForm(t, newTestModel())

	m = typeText(t, m, "Admin")
	m, _ = press(t, m, "enter")
	m = typeText(t, m, "admin@example.com")
	m, _ = press(t, m, "enter")
	m = typeText(t, m, "short")
	next, cmd := press(t, m, "enter")

	assert.Equal(t, 2, next.adminForm.step, "short password must not advance")
	assert.Contains(t, next.adminForm.errText, "8-72 bytes")
	assert.False(t, next.busy)
	assert.Nil(t, cmd)
	assert.NotContains(t, next.View(), "short", "the password must never be echoed")
}

func TestCreateAdminFormPasswordMismatch(t *testing.T) {
	m := openAdminForm(t, newTestModel())

	m = typeText(t, m, "Admin")
	m, _ = press(t, m, "enter")
	m = typeText(t, m, "admin@example.com")
	m, _ = press(t, m, "enter")
	m = typeText(t, m, "password123")
	m, _ = press(t, m, "enter")
	m = typeText(t, m, "password124")
	next, cmd := press(t, m, "enter")

	assert.Equal(t, 3, next.adminForm.step, "mismatch must stay on the confirm field")
	assert.Equal(t, "passwords do not match", next.adminForm.errText)
	assert.False(t, next.busy)
	assert.Nil(t, cmd)
	assert.NotContains(t, next.View(), "password123")
	assert.NotContains(t, next.View(), "password124")
}

func TestDiagnoseFailureRenders(t *testing.T) {
	m := newTestModel()
	m.scr = screenSystem
	m.checks = []Check{
		{Name: "config", OK: true, Detail: "valid"},
		{Name: "postgres", OK: false, Detail: "connection refused"},
	}

	out := m.View()
	assert.Contains(t, out, "[OK]")
	assert.Contains(t, out, "[FAIL] postgres")
	assert.Contains(t, out, "connection refused")
}

func TestDiagnoseWithNilConfigDoesNotPanic(t *testing.T) {
	require.NotPanics(t, func() {
		checks := diagnose(context.Background(), nil)
		assert.Len(t, checks, 5)
		for _, c := range checks {
			assert.False(t, c.OK)
			assert.NotEmpty(t, c.Detail)
		}
	})
}

func TestEmptyStates(t *testing.T) {
	t.Run("migrations", func(t *testing.T) {
		m := newTestModel()
		m.scr = screenDatabase
		m.migrationsDone = true

		assert.Contains(t, m.View(), "no migrations found")
	})

	t.Run("backups", func(t *testing.T) {
		m := newTestModel()
		m.scr = screenBackups
		m.backupsDone = true

		assert.Contains(t, m.View(), "no backups found")
	})

	t.Run("admins", func(t *testing.T) {
		m := newTestModel()
		m.scr = screenUsers
		m.adminsDone = true

		assert.Contains(t, m.View(), "no admin users found")
	})
}

func TestMigrationTableIsCapped(t *testing.T) {
	m := newTestModel()
	m.scr = screenDatabase
	m.height = 24
	m.migrationsDone = true
	for i := int64(1); i <= 40; i++ {
		m.migrations = append(m.migrations, MigrationRow{Version: i, Name: "m.sql", Applied: true})
	}

	out := m.View()
	assert.Contains(t, out, "more")
	assert.NotContains(t, out, strings.Repeat("\n", 40))
}

func TestDriftBanner(t *testing.T) {
	assert.Empty(t, driftBanner([]MigrationRow{{Version: 1, Applied: true}}))
	assert.Contains(t, driftBanner([]MigrationRow{{Version: 1, Applied: false}}), "pending")
	assert.Contains(t, driftBanner([]MigrationRow{
		{Version: 1, Applied: true},
		{Version: 2, Name: missingMigrationName, Applied: true},
	}), "not in this build")
}

// TestRunTUIQuits proves the real program, not just updateKey, starts and
// returns when the menu receives q. Without this, a broken Run wiring would
// leave an operator stuck in the alternate screen.
func TestRunTUIQuits(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		_, err := tea.NewProgram(
			newModel(ctx, nil),
			tea.WithInput(strings.NewReader("q")),
			tea.WithOutput(io.Discard),
		).Run()
		done <- err
	}()

	select {
	case err := <-done:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal("the TUI did not exit after q")
	}
}
