declare const __dirname: string;
declare const process: {
  cwd(): string;
};
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
declare module 'node:fs' {
  const fs: any;
  export = fs;
}
declare module 'node:path' {
  const path: any;
  export = path;
}
declare namespace vscode {
  type DocumentSelector = any;
  type ExtensionContext = any;
  type TextDocument = any;
  type Position = any;
  type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;
  type Hover = any;
  type CodeLens = any;
  type Diagnostic = any;
  type DiagnosticCollection = any;
  interface HoverProvider {
    provideHover(document: TextDocument, position: Position): ProviderResult<Hover>;
  }
  interface CodeLensProvider {
    readonly onDidChangeCodeLenses?: any;
    provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]>;
  }
}

declare module 'vscode' {
  const vscode: any;
  export = vscode;
}
