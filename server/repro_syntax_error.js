const http = require('http');

function sendRequest(bodyString) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/test-data',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyString)
        }
    };

    const req = http.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`Body: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(bodyString);
    req.end();
}

// 1. Valid JSON
console.log('--- Test 1: Valid JSON ---');
sendRequest(JSON.stringify({ name: "Valid", table: "test_webhook", action: "POST" }));

// 2. Malformed JSON (Missing bracket)
setTimeout(() => {
    console.log('\n--- Test 2: Malformed JSON (Missing proper closing) ---');
    sendRequest('{"name": "Bad"');
}, 1000);

// 3. Malformed JSON (Bad quote)
setTimeout(() => {
    // This matches "Expected ',' or '}' after property value"
    console.log('\n--- Test 3: Malformed JSON (Bad trailing comma/quote) ---');
    // {"key": "val" "key2"} -> missing comma
    // {"key": "val",} -> trailing comma in standard JSON (usually strict mode fails)
    sendRequest('{"name": "Bad",, "table": "test"}');
}, 2000);
