// jest-expo, plus one mapping. lucide-react-native's React Native entry is an
// ES module (.mjs), which Jest can't load, so tests use its CommonJS build.
// Metro, which builds the app itself, is unaffected. jest.setup.js stands in
// for the safe area.
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^lucide-react-native$': require.resolve('lucide-react-native'),
  },
};
