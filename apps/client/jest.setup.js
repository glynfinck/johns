// The app sits in a SafeAreaProvider (Expo Router's); a component rendered
// alone in a test doesn't, so it gets the library's own stand-in: no notch,
// no home bar.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// On a phone the session and the look are kept in SQLite (expo-sqlite's
// localStorage), a native module Jest can't load; tests get the same
// interface in memory (a test that reads it clears it first).
jest.mock('./src/api/storage', () => {
  const items = new Map();
  const storage = {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  };
  return { authStorage: storage };
});
