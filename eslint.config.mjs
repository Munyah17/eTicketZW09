import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**"],
  },
  {
    rules: {
      // React Compiler "readiness" rules — this project doesn't use the
      // React Compiler (no babel-plugin-react-compiler, no
      // experimental.reactCompiler), so these flag ordinary, correct
      // useEffect(() => fetch().then(setState)) patterns as errors.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
];

export default eslintConfig;
