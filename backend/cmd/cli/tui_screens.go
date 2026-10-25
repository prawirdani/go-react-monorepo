package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

var (
	titleStyle  = lipgloss.NewStyle().Bold(true)
	cursorStyle = lipgloss.NewStyle().Bold(true)
	dimStyle    = lipgloss.NewStyle().Faint(true)
	okStyle     = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("2"))
	failStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("1"))
)

// header renders a screen title.
func header(title string) string {
	return titleStyle.Render(title) + "\n\n"
}

// hint renders the one-line key bar.
func (m model) hint(text string) string {
	return "\n" + dimStyle.Render(text)
}

// statusView renders the busy spinner and the last notice or error.
func (m model) statusView() string {
	var b strings.Builder
	if m.busy {
		b.WriteString(m.spinner.View())
		b.WriteString(" working...\n")
	}
	if m.errText != "" {
		b.WriteString(failStyle.Render("! " + m.errText))
		b.WriteString("\n")
	}
	if m.notice != "" {
		b.WriteString(okStyle.Render("+ " + m.notice))
		b.WriteString("\n")
	}
	if b.Len() > 0 {
		b.WriteString("\n")
	}
	return b.String()
}

// actionList renders a menu of actions with the cursor on one of them.
func actionList(actions []string, cursor int) string {
	var b strings.Builder
	for i, action := range actions {
		if i == cursor {
			b.WriteString(cursorStyle.Render("> " + action))
		} else {
			b.WriteString("  " + action)
		}
		b.WriteString("\n")
	}
	return b.String()
}

// menuView renders the four-section main menu.
func (m model) menuView() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("Developer CLI"))
	b.WriteString("\n")
	b.WriteString(dimStyle.Render("database, backups, users, system"))
	b.WriteString("\n\n")

	for i, item := range menuItems {
		if i == m.menu {
			b.WriteString(cursorStyle.Render("> " + item.title))
		} else {
			b.WriteString("  " + item.title)
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(m.statusView())
	b.WriteString(m.hint("up/down or j/k move  enter select  q quit"))
	return b.String()
}

// databaseView renders migration status plus the database actions.
func (m model) databaseView() string {
	var b strings.Builder
	b.WriteString(header("Database"))

	switch {
	case m.migrationsDone:
		if banner := driftBanner(m.migrations); banner != "" {
			b.WriteString(failStyle.Render(banner))
			b.WriteString("\n\n")
		} else if len(m.migrations) > 0 {
			b.WriteString(okStyle.Render("in sync: embedded and applied agree"))
			b.WriteString("\n\n")
		}
		b.WriteString(m.migrationTable())
		b.WriteString("\n")
	case m.busy:
		b.WriteString(dimStyle.Render("loading migration status"))
		b.WriteString("\n\n")
	default:
		b.WriteString(dimStyle.Render("status not loaded"))
		b.WriteString("\n\n")
	}

	b.WriteString(m.statusView())
	b.WriteString(actionList(databaseActions, m.dbCursor))

	if m.dbMode == dbModeConfirmDown {
		b.WriteString("\n")
		b.WriteString(failStyle.Render(fmt.Sprintf(
			"roll back %d migration(s)? [y] confirm  [n] cancel  (1-9 sets count)", m.downSteps,
		)))
		b.WriteString("\n")
	}
	if m.dbMode == dbModeCreateName {
		b.WriteString("\nnew migration name: ")
		b.WriteString(m.input.View())
		b.WriteString("\n")
	}

	return b.String() + m.hint("up/down move  enter run  esc back")
}

// migrationTable renders the loaded migration rows, capped to the terminal.
func (m model) migrationTable() string {
	if len(m.migrations) == 0 {
		return dimStyle.Render("no migrations found") + "\n"
	}

	limit := 14
	if m.height > 0 {
		if room := m.height - 14; room < limit {
			limit = room
		}
	}
	if limit < 3 {
		limit = 3
	}

	var b strings.Builder
	fmt.Fprintf(&b, "%-12s %-8s %-20s %s\n", "VERSION", "STATE", "APPLIED AT", "NAME")
	shown := 0
	for _, row := range m.migrations {
		if shown >= limit {
			fmt.Fprintf(&b, "... %d more\n", len(m.migrations)-shown)
			break
		}
		state := "pending"
		at := "-"
		if row.Applied {
			state = "applied"
			if !row.AppliedAt.IsZero() {
				at = row.AppliedAt.Local().Format("2006-01-02 15:04:05")
			}
		}
		fmt.Fprintf(&b, "%-12d %-8s %-20s %s\n", row.Version, state, at, truncate(row.Name, 34))
		shown++
	}
	return b.String()
}

// driftBanner names every embedded/applied mismatch, "" when there is none.
func driftBanner(rows []MigrationRow) string {
	var pending, orphan int
	for _, row := range rows {
		switch {
		case row.Name == missingMigrationName:
			orphan++
		case !row.Applied:
			pending++
		}
	}
	if pending == 0 && orphan == 0 {
		return ""
	}

	parts := make([]string, 0, 2)
	if pending > 0 {
		parts = append(parts, fmt.Sprintf("%d pending", pending))
	}
	if orphan > 0 {
		parts = append(parts, fmt.Sprintf("%d applied but not in this build", orphan))
	}
	return "DRIFT: " + strings.Join(parts, ", ")
}

// backupsView renders the backup actions and their results.
func (m model) backupsView() string {
	var b strings.Builder
	b.WriteString(header("Backups"))
	b.WriteString(m.statusView())

	if m.backupKey != "" {
		b.WriteString("key: ")
		b.WriteString(m.backupKey)
		b.WriteString("\n\n")
	}

	if lines := m.progress.snapshot(); len(lines) > 0 {
		start := 0
		if len(lines) > 5 {
			start = len(lines) - 5
		}
		for _, line := range lines[start:] {
			b.WriteString(dimStyle.Render("  " + line))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	if m.backupsDone {
		if len(m.backupObjects) == 0 {
			b.WriteString(dimStyle.Render("no backups found"))
			b.WriteString("\n\n")
		} else {
			b.WriteString(m.backupTable())
			b.WriteString("\n")
		}
	}

	b.WriteString(actionList(backupActions, m.backupCursor))
	return b.String() + m.hint("up/down move  enter run  esc back")
}

// backupTable renders the listed backup objects.
func (m model) backupTable() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%-44s %10s %s\n", "KEY", "SIZE", "MODIFIED")
	for _, o := range m.backupObjects {
		fmt.Fprintf(&b, "%-44s %10s %s\n",
			truncate(o.Key, 44),
			formatSize(o.Size),
			o.LastModified.Local().Format(time.RFC3339),
		)
	}
	return b.String()
}

// usersView renders the admin actions or the create-admin form.
func (m model) usersView() string {
	var b strings.Builder
	b.WriteString(header("Users"))

	if m.userMode == userModeForm {
		for i := 0; i < m.adminForm.step; i++ {
			value := m.adminForm.values[i]
			if i >= 2 {
				value = "********"
			}
			b.WriteString(dimStyle.Render(createAdminLabels[i] + value))
			b.WriteString("\n")
		}
		b.WriteString(createAdminLabels[m.adminForm.step])
		b.WriteString(m.input.View())
		b.WriteString("\n")
		if m.adminForm.errText != "" {
			b.WriteString("\n")
			b.WriteString(failStyle.Render("! " + m.adminForm.errText))
			b.WriteString("\n")
		}
		b.WriteString(m.statusView())
		return b.String() + m.hint("enter next  esc cancel")
	}

	b.WriteString(m.statusView())
	if m.adminsDone {
		if len(m.admins) == 0 {
			b.WriteString(dimStyle.Render("no admin users found"))
			b.WriteString("\n\n")
		} else {
			b.WriteString(m.adminTable())
			b.WriteString("\n")
		}
	}

	b.WriteString(actionList(userActions, m.userCursor))
	return b.String() + m.hint("up/down move  enter run  esc back")
}

// adminTable renders the admin accounts, read-only.
func (m model) adminTable() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%-24s %-32s %s\n", "NAME", "EMAIL", "CREATED")
	for _, a := range m.admins {
		fmt.Fprintf(&b, "%-24s %-32s %s\n",
			truncate(a.Name, 24),
			truncate(a.Email, 32),
			a.CreatedAt.Local().Format(time.RFC3339),
		)
	}
	return b.String()
}

// systemView renders the version, diagnostics and permission sync output.
func (m model) systemView() string {
	var b strings.Builder
	b.WriteString(header("System"))
	b.WriteString("version: ")
	b.WriteString(m.v)
	b.WriteString("\n\n")

	if len(m.checks) == 0 {
		b.WriteString(dimStyle.Render("diagnostics not run"))
		b.WriteString("\n\n")
	} else {
		b.WriteString(m.checkList())
		b.WriteString("\n")
	}

	b.WriteString(m.statusView())

	if m.syncOutput != "" {
		b.WriteString("permission catalog:\n")
		for _, line := range strings.Split(m.syncOutput, "\n") {
			b.WriteString(dimStyle.Render("  " + truncate(line, 100)))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	b.WriteString(actionList(systemActions, m.systemCursor))
	return b.String() + m.hint("up/down move  enter run  esc back")
}

// checkList renders each diagnostic with OK or FAIL and its detail.
func (m model) checkList() string {
	var b strings.Builder
	for _, c := range m.checks {
		if c.OK {
			b.WriteString(okStyle.Render("[OK]   "))
		} else {
			b.WriteString(failStyle.Render("[FAIL] "))
		}
		fmt.Fprintf(&b, "%-14s %s\n", c.Name, truncate(c.Detail, 60))
	}
	return b.String()
}

// formatSize renders a byte count in the largest fitting binary unit.
func formatSize(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGT"[exp])
}

// truncate cuts s to n bytes, marking the cut with "...".
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return s[:n-3] + "..."
}
