set -uo pipefail
 
WEB_URL="${WEB_URL:-}"
API_URL="${API_URL:-}"
LIMITE="${SMOKE_TIMEOUT:-90}"
INTERVALO="${SMOKE_INTERVALO:-5}"
 
if [ -z "$WEB_URL" ] || [ -z "$API_URL" ]; then
  echo "::error::Defina WEB_URL e API_URL (URLs publicadas do front e da API)."
  exit 2
fi
 
# Tenta a URL até dar certo ou estourar o limite (o Render dorme e leva até ~1 min para acordar).
checar() {
  local nome="$1" url="$2" inicio codigo
  inicio=$(date +%s)
  while true; do
    codigo=$(curl --fail --silent --show-error --location --max-time 20 \
      --output /dev/null --write-out '%{http_code}' "$url" 2>/tmp/smoke-erro.txt) && {
      echo "OK    $nome  $url  (HTTP $codigo, $(( $(date +%s) - inicio ))s)"
      return 0
    }
    if [ $(( $(date +%s) - inicio )) -ge "$LIMITE" ]; then
      echo "FALHA $nome  $url  (sem resposta válida em ${LIMITE}s; último: HTTP ${codigo:-000} $(tr '\n' ' ' </tmp/smoke-erro.txt))"
      echo "::error title=Smoke test falhou::$nome não respondeu em ${LIMITE}s ($url)"
      return 1
    fi
    echo "...   $nome  $url  (HTTP ${codigo:-000}; nova tentativa em ${INTERVALO}s)"
    sleep "$INTERVALO"
  done
}
 
falhas=0
checar "web"    "${WEB_URL%/}/"        || falhas=$((falhas + 1))
checar "healthz" "${API_URL%/}/healthz" || falhas=$((falhas + 1))
checar "readyz"  "${API_URL%/}/readyz"  || falhas=$((falhas + 1))
 
if [ "$falhas" -gt 0 ]; then
  echo "Smoke test: $falhas de 3 verificações falharam."
  exit 1
fi
echo "Smoke test: 3 de 3 verificações passaram."