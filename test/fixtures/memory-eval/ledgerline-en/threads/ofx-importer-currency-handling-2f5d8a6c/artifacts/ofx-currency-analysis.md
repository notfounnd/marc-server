# OFX currency analysis

Decisive rule for the importer. The amounts are stored with the exponent of the ISO 4217 currency code, so the number of decimal places follows the currency and not the bank.

| Currency | Exponent | Example stored value for 12.50 |
| -------- | -------- | ------------------------------ |
| JPY      | 0        | 13                             |
| USD      | 2        | 1250                           |
| BHD      | 3        | 12500                          |

Amounts in the OFX file are read as decimal text. The importer converts them to integers with the exponent above, and it never rounds a value that has more digits than the exponent allows. Such a value is rejected with the line number.
