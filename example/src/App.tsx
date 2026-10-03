import { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PremblyTM } from '@prembly/tm-sdk-react-native';

// From the Android emulator the host machine is 10.0.2.2; the iOS simulator uses localhost.
const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8010' : 'http://localhost:8010';

export default function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [publicKey, setPublicKey] = useState('');
  const [customerId, setCustomerId] = useState('CUST-DEMO-1');
  const [location, setLocation] = useState(false);
  const [output, setOutput] = useState('Tap a button.');

  const setup = () => {
    PremblyTM.init({
      publishableKey: publicKey.trim(),
      baseUrl: baseUrl.trim(),
      location,
      debug: true,
    });
    PremblyTM.identify(customerId.trim() || null);
  };

  const show = (value: unknown) => setOutput(JSON.stringify(value, null, 2));

  const preview = async () => {
    try {
      setup();
      show(await PremblyTM.getSignalsPreview());
    } catch (error) {
      setOutput(String(error));
    }
  };

  const createSession = async () => {
    try {
      setup();
      show(await PremblyTM.getDeviceSession({ forceRefresh: true }));
    } catch (error) {
      setOutput(String(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Prembly TM SDK</Text>

        <Text style={styles.label}>API base URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Public key (test_pk_… or live_pk_…)</Text>
        <TextInput
          style={styles.input}
          value={publicKey}
          onChangeText={setPublicKey}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="test_pk_..."
        />

        <Text style={styles.label}>Customer ID</Text>
        <TextInput
          style={styles.input}
          value={customerId}
          onChangeText={setCustomerId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.row}>
          <Text style={styles.label}>Include location</Text>
          <Switch value={location} onValueChange={setLocation} />
        </View>

        <TouchableOpacity style={styles.button} onPress={preview}>
          <Text style={styles.buttonText}>Preview signals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={createSession}>
          <Text style={styles.buttonText}>Create device session</Text>
        </TouchableOpacity>

        <Text selectable style={styles.output}>
          {output}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, color: '#444', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#0f766e',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  output: {
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#111',
  },
});
