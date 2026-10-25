// The app sits in a SafeAreaProvider (Expo Router's); a component rendered
// alone in a test doesn't, so it gets the library's own stand-in: no notch,
// no home bar.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
