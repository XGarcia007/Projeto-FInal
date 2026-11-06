const twilio = require('twilio');

const cooldownMinutes = Number.parseFloat(process.env.ALERT_COOLDOWN_MINUTES || '15');
const cooldownMs = (Number.isFinite(cooldownMinutes) && cooldownMinutes > 0
	? cooldownMinutes
	: 15) * 60 * 1000;
const lastSentAt = new Map();

let twilioClient;

function getTwilioClient() {
	const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
	if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN ||
			TWILIO_ACCOUNT_SID === 'seu_account_sid_aqui' ||
			TWILIO_AUTH_TOKEN === 'seu_auth_token_aqui') {
		return null;
	}

	if (!twilioClient) {
		twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
	}
	return twilioClient;
}

function isCoolingDown(channel, contact) {
	const key = `${channel}:${contact}`;
	const sentAt = lastSentAt.get(key);
	return sentAt !== undefined && Date.now() - sentAt < cooldownMs;
}

function markSent(channel, contact) {
	lastSentAt.set(`${channel}:${contact}`, Date.now());
}

function readContacts(variableName) {
	return (process.env[variableName] || '')
		.split(',')
		.map((contact) => contact.trim())
		.filter(Boolean);
}

async function sendEmergencyCall(contact, reason) {
	const client = getTwilioClient();
	const from = process.env.TWILIO_PHONE_NUMBER;
	if (!client || !from) {
		return { sent: false, skipped: true, reason: 'Twilio nao configurado' };
	}
	if (isCoolingDown('call', contact)) {
		return { sent: false, skipped: true, reason: 'cooldown ativo' };
	}

	const voiceResponse = new twilio.twiml.VoiceResponse();
	voiceResponse.say({ language: 'pt-BR', voice: 'alice' },
		`Atenção! Alerta crítico no PisciAlerta. ${reason}`);

	try {
		const call = await client.calls.create({
			to: contact,
			from,
			twiml: voiceResponse.toString(),
		});
		markSent('call', contact);
		return { sent: true, sid: call.sid };
	} catch (error) {
		console.error(`Falha ao iniciar chamada para ${contact}:`, error.message);
		return { sent: false, error: error.message };
	}
}

async function sendWhatsAppMessage(contact, reason) {
	const client = getTwilioClient();
	const from = process.env.TWILIO_WHATSAPP_NUMBER;
	if (!client || !from) {
		return { sent: false, skipped: true, reason: 'WhatsApp Twilio nao configurado' };
	}
	if (isCoolingDown('whatsapp', contact)) {
		return { sent: false, skipped: true, reason: 'cooldown ativo' };
	}

	const normalizedTo = contact.startsWith('whatsapp:') ? contact : `whatsapp:${contact}`;
	const normalizedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
	try {
		const message = await client.messages.create({
			to: normalizedTo,
			from: normalizedFrom,
			body: `ALERTA PisciAlerta: ${reason}`,
		});
		markSent('whatsapp', contact);
		return { sent: true, sid: message.sid };
	} catch (error) {
		console.error(`Falha ao enviar WhatsApp para ${contact}:`, error.message);
		return { sent: false, error: error.message };
	}
}

async function dispatchEmergencyAlerts(reason) {
	const callContacts = readContacts('ALERT_CONTACTS');
	const whatsappContacts = readContacts('WHATSAPP_CONTACTS');
	const jobs = [
		...callContacts.map((contact) => sendEmergencyCall(contact, reason)),
		...whatsappContacts.map((contact) => sendWhatsAppMessage(contact, reason)),
	];

	if (jobs.length === 0) {
		console.warn('Alerta critico sem destinatarios: configure ALERT_CONTACTS e WHATSAPP_CONTACTS.');
		return [];
	}
	return Promise.all(jobs);
}

module.exports = {
	sendEmergencyCall,
	sendWhatsAppMessage,
	dispatchEmergencyAlerts,
};