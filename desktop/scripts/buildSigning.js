function resolveBuildSigning(platform, env = process.env) {
  const required = env.MU_REQUIRE_SIGNED_BUILD === '1';
  const signed = platform === 'win32' && Boolean(env.CSC_LINK && env.CSC_KEY_PASSWORD);
  if (required && !signed) {
    throw new Error(
      platform === 'win32'
        ? 'This build requires Authenticode signing. Set CSC_LINK and CSC_KEY_PASSWORD to a trusted Windows code-signing certificate.'
        : 'This build requires signing, but only Windows Authenticode signing is configured for desktop release builds.'
    );
  }
  return {
    required,
    signed,
    signatureKind: signed ? 'authenticode' : 'none',
  };
}

function buildProvenance({ platform, arch, signing }) {
  return {
    schemaVersion: 1,
    platform,
    arch,
    signed: signing.signed,
    signatureKind: signing.signatureKind,
  };
}

module.exports = {
  buildProvenance,
  resolveBuildSigning,
};
