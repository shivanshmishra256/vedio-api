const axios = require('axios');

async function testVideoAPI() {
    console.log("🚀 Testing Video Generation API on Railway...");
    
    try {
        const response = await axios.post(
            'http://localhost:3000/api/generate',
            {
                text: "A magical glowing tree in the middle of a dark forest",
                language: "hindi",
                voice: "male",
                duration: 10
            }
        );

        console.log("\n✅ SUCCESS! API is working perfectly.");
        console.log("------------------------------------------------");
        console.log("Message: ", response.data.message);
        console.log("Final Video URL: ", response.data.final_video_url);
        
        console.log("\n🎬 Generated Scenes from AI:");
        response.data.scenes.forEach((scene, index) => {
            console.log(`\nScene ${scene.scene_number || index + 1}:`);
            console.log(`- Description: ${scene.scene_description}`);
            console.log(`- Character: ${scene.characters}`);
            console.log(`- Environment: ${scene.environment}`);
            console.log(`- Camera: ${scene.camera_angle}`);
            console.log(`- Mood: ${scene.mood}`);
            console.log(`- Audio URL: ${scene.audio_url || 'Not available'}`);
            console.log(`- Video URL: ${scene.video_url || 'Not available'}`);
        });

    } catch (error) {
        console.error("\n❌ ERROR! Request failed.");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error("Message:", error.message);
            console.log("\n(Tip: Agar 'getaddrinfo ENOTFOUND' error aaye, toh iska matlab abhi thodi der lag rahi hai DNS update hone me. Ek do baar aur run karke dekhna.)");
        }
    }
}

testVideoAPI();
