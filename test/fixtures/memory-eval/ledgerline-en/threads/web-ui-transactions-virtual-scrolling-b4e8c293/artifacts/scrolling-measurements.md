# Scrolling measurements

Measured on the reference laptop with 80,000 transactions in one account.

| Mode                                      | First paint | Scroll frame time (p95) | Memory used by the list |
| ----------------------------------------- | ----------- | ----------------------- | ----------------------- |
| Paged list, fifty rows per page           | 140 ms      | 16 ms                   | 3 MB                    |
| Virtual list, two hundred rows per window | 210 ms      | 18 ms                   | 9 MB                    |

The virtual list is slower on the first paint and uses more memory, but it keeps one scroll position across the whole history. The paged list stays available behind a setting.
