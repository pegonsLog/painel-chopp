export interface Label {
  /** ID do documento no Firestore. */
  id?: string;
  /** Nome identificador do rótulo (ex.: "Stardust NEIPA"). */
  name: string;
  /** URL pública da imagem no Firebase Storage. */
  url: string;
  /** Caminho (path) do arquivo no bucket, usado para deleção. */
  path: string;
  /** Data de criação (timestamp). */
  createdAt?: number;
}
