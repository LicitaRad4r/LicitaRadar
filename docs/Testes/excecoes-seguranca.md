# Exceções de segurança

O CI falha em vulnerabilidade `CRITICAL` ou `HIGH`. Esta lista é o que a imagem `node:22-bookworm-slim` ainda carrega e que não dá para corrigir no `package-lock` da API. O `.trivyignore` na raiz repete os mesmos CVEs e expira em **2026-12-27**. Nessa data o scan volta a falhar se a exceção continuar.

O `apt-get upgrade` da imagem já aplicou a correção do Debian para o `libpam` (`CVE-2025-6020`). Esses itens não entram aqui.

## Debian 12, sem pacote corrigido

O Trivy marca o status como `affected`, `will_not_fix` ou `fix_deferred`. Não há versão corrigida no bookworm.

| Pacote | CVE | Severidade | Motivo | Rever em |
| ------ | --- | ---------- | ------ | -------- |
| zlib1g | CVE-2023-45853 | crítica | `will_not_fix` no Debian | 2026-12-27 |
| zlib1g | CVE-2026-85091 | alta | sem correção publicada | 2026-12-27 |
| ncurses (`libtinfo6`, `ncurses-base`, `ncurses-bin`) | CVE-2025-69720 | alta | sem correção publicada | 2026-12-27 |
| libzstd1 | CVE-2026-124851 | alta | sem correção publicada | 2026-12-27 |
| systemd (`libsystemd0`, `libudev1`) | CVE-2026-16742 | alta | correção adiada no Debian | 2026-12-27 |
| gzip | CVE-2026-41992 | alta | correção adiada no Debian | 2026-12-27 |
| util-linux | CVE-2026-53613 | alta | sem correção publicada | 2026-12-27 |
| util-linux | CVE-2026-53615 | alta | sem correção publicada | 2026-12-27 |
| util-linux | CVE-2026-78410 | alta | sem correção publicada | 2026-12-27 |
| libacl1 | CVE-2026-54369 | alta | correção adiada no Debian | 2026-12-27 |
| perl-base | CVE-2026-9538 | alta | correção adiada no Debian | 2026-12-27 |

## npm que vem dentro da imagem oficial do Node

Esses pacotes não estão no `server/package-lock.json`. Eles vêm com o npm da tag `node:22-bookworm-slim`. A versão corrigida existe no npm, mas a tag atual da imagem ainda não a traz. Trocar o lockfile da API não muda isso.

| Pacote | CVE | Severidade | Motivo | Rever em |
| ------ | --- | ---------- | ------ | -------- |
| brace-expansion 2.0.2 | CVE-2026-102276 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| brace-expansion 2.0.2 | CVE-2026-102278 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| brace-expansion 2.0.2 | CVE-2026-13149 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| brace-expansion 2.0.2 | CVE-2026-14257 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| brace-expansion 2.0.2 | CVE-2026-69152 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| picomatch 4.0.3 | CVE-2026-33671 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| sigstore 3.1.0 | CVE-2026-48815 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| ip-address 10.1.0 | CVE-2026-69192 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
| pacote 19.0.2 e 20.0.1 | CVE-2026-9496 | alta | imagem oficial ainda sem o patch | 2026-12-27 |
