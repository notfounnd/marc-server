# Theme persistence checks

Checks run before the page is painted, on the reference browser.

1. The stored theme is read from the settings file before the stylesheet is applied.
2. A missing value falls back to the system preference.
3. A corrupt value falls back to light theme and writes a warning to the log.
4. Switching theme does not reload the page, and the chart colors update with the theme.
