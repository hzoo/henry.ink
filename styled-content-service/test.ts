// Simple test script for the MVP
async function testService() {
  const testUrl = 'https://example.com';
  
  try {
    const response = await fetch('http://localhost:3001/process-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl }),
    });

    const result = await response.json();
    console.log('✅ Service responded');
    console.log('Title:', result.metadata.title);
    console.log('Domain:', result.metadata.domain);
    console.log('HTML length:', result.html.length);
    
    if (result.html.includes('style=')) {
      console.log('✅ Styles are inlined');
    } else {
      console.log('⚠️  No inline styles found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testService();