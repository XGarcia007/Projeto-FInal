require('dotenv').config();
require('./config/database');

const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const relayRoutes = require('./routes/relayRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/relays', relayRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/users', userRoutes);

app.use((error, _req, res, _next) => {
	if (error instanceof SyntaxError && 'body' in error) {
		return res.status(400).json({ error: 'JSON invalido.' });
	}
	console.error('Erro inesperado na API:', error.message);
	return res.status(500).json({ error: 'Erro interno do servidor.' });
});

if (require.main === module) {
	app.listen(port, () => {
		console.log(`PisciAlerta API ouvindo na porta ${port}.`);
		if (process.env.SIMULATOR_ENABLED === 'true') {
			require('./simulator').startSimulator();
		}
	});
}

module.exports = app;