# Column mapping fixtures

Eight header variants used by the v2 importer tests. Each row shows the header as it arrives and the column it maps to.

| Variant | Header as it arrives                            | Detected columns                                        |
| ------- | ----------------------------------------------- | ------------------------------------------------------- | --- | ----- | ---------------------------------- |
| 1       | Date;Description;Amount;Balance                 | date, description, amount, balance                      |
| 2       | Posting Date,Payee,Debit,Credit,Running Balance | date, description, amount (debit minus credit), balance |
| 3       | Title line, then a blank line, then the header  | header found at row 3                                   |
| 4       | Transaction date ; Memo ; Value                 | date, description, amount                               |
| 5       | BOOKING_DATE,PARTNER,AMOUNT_EUR                 | date, description, amount                               |
| 6       | Date,Details,Money out,Money in,Balance         | date, description, amount, balance                      |
| 7       | Value date                                      | Text                                                    | Sum | Saldo | date, description, amount, balance |
| 8       | Unknown column order without names              | rejected, mapping needs confirmation                    |

Variant 8 is rejected by design. The user confirms a mapping, and the confirmed mapping is then saved for the profile.
