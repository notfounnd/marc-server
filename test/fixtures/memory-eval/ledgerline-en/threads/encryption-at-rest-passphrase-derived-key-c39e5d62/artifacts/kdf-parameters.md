# Key derivation parameters

Parameters of the release build. The header of the database stores them, so a file can be opened on any machine that has the passphrase.

| Parameter          | Value                         |
| ------------------ | ----------------------------- |
| Function           | memory-hard password hash     |
| Memory cost        | 64 MiB                        |
| Iterations         | 3                             |
| Parallelism        | 1                             |
| Salt length        | 16 bytes, random per database |
| Derived key length | 32 bytes                      |

The startup delay measured on the reference laptop is about 0.6 seconds. The delay is intentional and the UI shows a progress line while it runs.
