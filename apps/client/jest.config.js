// jest-expo, plus one mapping. lucide-react-native's React Native entry is an
// ES module (.mjs), which Jest can't load, so tests use its CommonJS build.
// Metro, which builds the app itself, is unaffected.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^lucide-react-native$': require.resolve('lucide-react-native'),
  },
};
