const server = Bun.serve({
	fetch(req, server) {
		const success = server.upgrade(req);
		if (success) {
			// Bun automatically returns a 101 Switching Protocols
			// if the upgrade succeeds
			return undefined;
		}

		// handle HTTP request normally
		return new Response("Hello world!");
	},
	websocket: {
		// this is called when a message is received
		async message(ws, message) {
			try {
				const data = JSON.parse(message.toString());
				
				if (data.type === 'timeline_data') {
					// Create a filename with timestamp
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
					const filename = `timeline_data_${timestamp}.json`;
					
					// Write the data to disk
					await Bun.write(filename, JSON.stringify(data.data, null, 2));
					console.log(`Saved timeline data to ${filename}`);
					
					// Acknowledge receipt
					ws.send(JSON.stringify({ 
						status: 'success', 
						message: `Data saved to ${filename}` 
					}));
				} else {
					console.log(`Received unknown message type: ${data.type}`);
				}
			} catch (error) {
				console.error('Error processing message:', error);
				ws.send(JSON.stringify({ 
					status: 'error', 
					message: error.message 
				}));
			}
		},
	},
});

console.log(`Listening on ${server.hostname}:${server.port}`);
