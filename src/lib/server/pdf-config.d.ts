declare module '*/pdf.config.cjs' {
  const config: {
    css: string;
    pdf_options: Record<string, unknown>;
  };
  export default config;
}
