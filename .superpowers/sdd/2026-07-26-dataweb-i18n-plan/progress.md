# SDD ledger — plan: docs/superpowers/plans/2026-07-26-dataweb-i18n-plan.md

## Branch

`refactor/i18n-ssd` (based on main @ b5df933)

## Tasks

Task 1: complete (52a8cf5, scaffold)
Task 2: complete (a2685d9, i18nSlice)
Task 3+4+5: complete (1b42f8c, URL sync + store + IntlProvider + dicts)
Task 6+7: complete (3a33b5d, I18nToggle + TopBar)
Task 8+9: complete (9a0d626 + 2800409, hook + barrel + CI lint)
Task 10: complete (build OK, dev server starts)
Task 11: complete (7218453, HomeRoute — A-style landing page)

## Additional

- Shell components migrated to t('key'): TopBar nav, StatusBar, LeftRail (2bc046c)
- Extended dicts to 78 keys, 40 referenced in source
- HomeRoute replaces `/` redirect with hero + search + species cards + comparison modes
- Build: 926 KB JS, typecheck 0 errors, i18n:check pass
