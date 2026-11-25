set -uo pipefail

WEB_URL="${WEB_URL:-}"
API_URL="${API_URL:-}"
LIMITE="${SMOKE_TIMEOUT:-90}"
INTERVALO="${SMOKE_INTERVALO:-5}"
# SHA do commit que acabou de ir para a main. Vazio no teste manual: aí o healthz só precisa responder 200.
COMMIT="${SMOKE_COMMIT:-}"
LIMITE_COMMIT="${SMOKE_COMMIT_TIMEOUT:-600}"

if [ -z "$WEB_URL" ] || [ -z "$API_URL" ]; then
  echo "::error::Defina WEB_URL e API_URL (URLs publicadas do front e da API)."
  exit 2
fi

# Tenta a URL até dar certo ou estourar o limite.
# Sem SHA esperado, HTTP 200 basta (o Render dorme e leva até ~1 min para acordar).
# Com SHA, o /healthz só passa quando o corpo traz esse commit: a API no ar é a deste deploy.
# O build do plano free passa de 90s, então essa espera usa SMOKE_COMMIT_TIMEOUT (10 min).
checar() {
  local nome="$1" url="$2" esperado="${3:-}" inicio codigo corpo commit limite
  inicio=$(date +%s)
  if [ -n "$esperado" ]; then
    limite="$LIMITE_COMMIT"
  else
    limite="$LIMITE"
  fi
  while true; do
    commit=""
    codigo=$(curl --silent --show-error --location --max-time 20 \
      --output /tmp/smoke-corpo.txt --write-out '%{http_code}' "$url" 2>/tmp/smoke-erro.txt || true)
    if [ "$codigo" = "200" ]; then
      if [ -z "$esperado" ]; then
        echo "OK    $nome  $url  (HTTP $codigo, $(( $(date +%s) - inicio ))s)"
        return 0
      fi
      corpo=$(tr -d '\n' </tmp/smoke-corpo.txt || true)
      commit=$(printf '%s' "$corpo" | sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([0-9a-fA-F]\{7,40\}\)".*/\1/p' | head -n 1)
      if [ "$(printf '%s' "$commit" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$esperado" | tr '[:upper:]' '[:lower:]')" ]; then
        echo "OK    $nome  $url  (HTTP $codigo, commit $commit, $(( $(date +%s) - inicio ))s)"
        return 0
      fi
      echo "...   $nome  $url  (HTTP $codigo, commit ${commit:-nenhum}, esperando $esperado; nova tentativa em ${INTERVALO}s)"
    else
      echo "...   $nome  $url  (HTTP ${codigo:-000}; nova tentativa em ${INTERVALO}s)"
    fi
    if [ $(( $(date +%s) - inicio )) -ge "$limite" ]; then
      if [ -n "$esperado" ]; then
        echo "FALHA $nome  $url  (commit ${commit:-nenhum} diferente de $esperado em ${limite}s; último HTTP ${codigo:-000})"
        echo "::error title=Smoke test falhou::$nome não publicou o commit $esperado em ${limite}s ($url)"
      else
        echo "FALHA $nome  $url  (sem resposta válida em ${limite}s; último: HTTP ${codigo:-000} $(tr '\n' ' ' </tmp/smoke-erro.txt))"
        echo "::error title=Smoke test falhou::$nome não respondeu em ${limite}s ($url)"
      fi
      return 1
    fi
    sleep "$INTERVALO"
  done
}

falhas=0
checar "web" "${WEB_URL%/}/" || falhas=$((falhas + 1))
checar "healthz" "${API_URL%/}/healthz" "$COMMIT" || falhas=$((falhas + 1))
checar "readyz" "${API_URL%/}/readyz" || falhas=$((falhas + 1))

if [ "$falhas" -gt 0 ]; then
  echo "Smoke test: $falhas de 3 verificações falharam."
  exit 1
fi
echo "Smoke test: 3 de 3 verificações passaram."
