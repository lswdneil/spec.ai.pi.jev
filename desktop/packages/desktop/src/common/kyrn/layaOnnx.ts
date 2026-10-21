/**
 * The local judge where Core ML does not run (Windows, Linux): Laya multilingual exported to ONNX, run by the app with
 * onnxruntime-node. The app never downloads the model: the person gets these files from Hugging Face (a link, or the
 * `hf` command below), puts them in the model folder, and the app checks them and starts the judge.
 *
 * The files are pinned to one revision of the repository, so the hashes below say exactly what was tested.
 */

export const LAYA_ONNX_REPO = 'mizchi/laya-multilingual-onnx';
export const LAYA_ONNX_REVISION = 'd9d003d543e63d6d3375c21d44624136bd1e0bad';
/** The folder under spec.jev's home that holds the model unless `MU_LOCAL_JUDGE_ONNX_DIR` names another one. */
export const LAYA_ONNX_FOLDER = ['local-judge', 'laya-multilingual-onnx'] as const;

export type LayaOnnxFile = {
  /** The path inside the repository. */
  name: string;
  bytes: number;
  sha256: string;
};

export const LAYA_ONNX_FILES: readonly LayaOnnxFile[] = [
  {
    name: 'model.onnx',
    bytes: 646_870_871,
    sha256: '0b095e005a4c295cae74d47b7eb6931c369d48f5b720b45278d774165798310c',
  },
  {
    name: 'onnx_config.json',
    bytes: 332,
    sha256: '13db475255d076da580a3435f28904e3360fe7f6380d7e3c75ee586e966ca5f0',
  },
  {
    name: 'rl_agent_config.json',
    bytes: 473,
    sha256: '9a669a70961064c3c6cc76d2afb8bc5fb10dcd8349bb66e5f7b9b1afb74440d5',
  },
  {
    name: 'tokenizer/tokenizer.json',
    bytes: 34_363_188,
    sha256: '609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f',
  },
  {
    name: 'tokenizer/tokenizer_config.json',
    bytes: 524,
    sha256: '6c6b2d8e3c84ce0e671c129cd6b374b235d6f9863042a5836358d00a89bbb5a1',
  },
];

/** What the person downloads in all, in MB, for the consent-free "get it yourself" text. */
export const LAYA_ONNX_DOWNLOAD_MB = Math.round(LAYA_ONNX_FILES.reduce((sum, file) => sum + file.bytes, 0) / 1_000_000);

/** The repository's file list at the pinned revision, for a person who downloads in the browser. */
export const LAYA_ONNX_PAGE = `https://huggingface.co/${LAYA_ONNX_REPO}/tree/${LAYA_ONNX_REVISION}`;

/** A direct link to one file at the pinned revision: the browser downloads it. */
export function layaOnnxFileUrl(name: string): string {
  return `https://huggingface.co/${LAYA_ONNX_REPO}/resolve/${LAYA_ONNX_REVISION}/${name}?download=true`;
}

/** The one command that fetches everything into the model folder, for a person who has the `hf` CLI. */
export function layaOnnxCommand(folder: string): string {
  return `hf download ${LAYA_ONNX_REPO} --revision ${LAYA_ONNX_REVISION} --local-dir "${folder}"`;
}
