// Lead submission test script
async function submitLead() {
  try {
    console.log('Submitting lead...');
    
    const payload = {
      firstName: "John",
      lastName: "Doe", 
      email: `john${Date.now()}@example.com`, // Ensure unique email
      phone: "+1234567890",
      country: "United States",
      brand: "Example Brand",
      source: "Website",
      funnel: "Main",
      desk: "Sales"
    };

    console.log('Request payload:', payload);

    const response = await fetch("https://kwiuzntxxsmezjgswact.supabase.co/functions/v1/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "BHX04DS3K1J4AU1AH6B6F3H7GOM43RXP"
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (!response.ok) {
      console.error('Error response:', data);
      throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
    }

    console.log("✅ Lead created:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Run the test
submitLead()
  .then(result => {
    console.log('Test completed successfully:', result);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });