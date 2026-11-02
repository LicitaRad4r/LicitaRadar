/**
 * Só para os testes (jsdom). O jsdom traz as próprias classes Blob, File e FormData, e a partir do
 * Node 24 o fetch do Node passa a recusar esses objetos: o arquivo de uma renovação de certidão
 * chegava vazio ao mock. No navegador isso não acontece.
 *
 * Aqui os testes passam a usar Blob, File e FormData nativos do Node. A troca é feita com
 * `defineProperty` no objeto global, sem mexer no `window` do jsdom, para não acionar a conversão
 * automática do vitest (que é justamente a parte que falha no Node 24).
 */
const { Blob: BlobNativo, File: FileNativo } = (await import(/* @vite-ignore */ `node:${'buffer'}`)) as {
  Blob: typeof Blob
  File: typeof File
}
const FormDataNativa = (await new Response(new URLSearchParams('a=1')).formData()).constructor as typeof FormData
const FormDataDoJsdom = (globalThis as unknown as { jsdom: { window: { FormData: typeof FormData } } }).jsdom.window
  .FormData

/**
 * O React monta `new FormData(formulario, botao)` ao enviar um <form>. O FormData do Node não aceita
 * formulário, então os campos de texto são lidos pelo FormData do jsdom e copiados.
 */
class FormDataCompativel extends FormDataNativa {
  constructor(formulario?: HTMLFormElement, botao?: HTMLElement | null) {
    super()
    if (!formulario) return
    new FormDataDoJsdom(formulario, botao).forEach((valor, nome) => {
      if (typeof valor === 'string') this.append(nome, valor)
    })
  }
}

for (const [nome, classe] of Object.entries({ Blob: BlobNativo, File: FileNativo, FormData: FormDataCompativel })) {
  Object.defineProperty(globalThis, nome, { value: classe, writable: true, configurable: true })
}
