const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Store the latest weather data
let latestWeatherData = {
    location: 'State College',
    temperature: 20,
    condition: 'Clear',
    humidity: 50,
    wind: 5,
    feelsLike: 20
};

// API endpoint to update weather data
app.post('/api/update-weather', (req, res) => {
    try {
        // Update the latest weather data
        latestWeatherData = {
            ...latestWeatherData,
            ...req.body
        };
        
        console.log('Weather data updated:', latestWeatherData);
        res.status(200).json({ success: true, message: 'Weather data updated successfully' });
    } catch (error) {
        console.error('Error updating weather data:', error);
        res.status(500).json({ success: false, message: 'Error updating weather data' });
    }
});

// API endpoint for weather assistant
app.post('/api/weather-assistant', (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ success: false, message: 'Question is required' });
        }
        
        // Get the latest weather data
        const weatherData = latestWeatherData;
        
        // Generate a response based on the question and weather data
        const response = generateWeatherResponse(question, weatherData);
        
        res.status(200).json({ 
            success: true, 
            response,
            weatherData
        });
    } catch (error) {
        console.error('Error processing weather question:', error);
        res.status(500).json({ success: false, message: 'Error processing weather question' });
    }
});

// Function to generate weather responses
function generateWeatherResponse(question, weatherData) {
    const questionLower = question.toLowerCase();
    
    // Temperature related questions
    if (questionLower.includes('temperature') || questionLower.includes('temp')) {
        if (questionLower.includes('current')) {
            return `The current temperature in ${weatherData.location} is ${weatherData.temperature}°C.`;
        } else if (questionLower.includes('feels like')) {
            return `It feels like ${weatherData.feelsLike}°C in ${weatherData.location}.`;
        } else if (questionLower.includes('hot') || questionLower.includes('cold')) {
            const temp = weatherData.temperature;
            if (temp > 30) {
                return `Yes, it's quite hot in ${weatherData.location} at ${temp}°C.`;
            } else if (temp > 20) {
                return `It's moderately warm in ${weatherData.location} at ${temp}°C.`;
            } else if (temp > 10) {
                return `It's a bit cool in ${weatherData.location} at ${temp}°C.`;
            } else {
                return `Yes, it's cold in ${weatherData.location} at ${temp}°C.`;
            }
        }
    }
    
    // Condition related questions
    if (questionLower.includes('weather') || questionLower.includes('condition')) {
        return `The current weather in ${weatherData.location} is ${weatherData.condition}.`;
    }
    
    // Humidity related questions
    if (questionLower.includes('humidity')) {
        const humidity = weatherData.humidity;
        let humidityDescription = '';
        
        if (humidity > 80) {
            humidityDescription = 'very humid';
        } else if (humidity > 60) {
            humidityDescription = 'moderately humid';
        } else if (humidity > 40) {
            humidityDescription = 'comfortable';
        } else if (humidity > 20) {
            humidityDescription = 'dry';
        } else {
            humidityDescription = 'very dry';
        }
        
        return `The humidity in ${weatherData.location} is ${humidity}%, which is ${humidityDescription}.`;
    }
    
    // Wind related questions
    if (questionLower.includes('wind')) {
        const wind = weatherData.wind;
        let windDescription = '';
        
        if (wind > 20) {
            windDescription = 'very windy';
        } else if (wind > 10) {
            windDescription = 'windy';
        } else if (wind > 5) {
            windDescription = 'moderately windy';
        } else if (wind > 2) {
            windDescription = 'slightly windy';
        } else {
            windDescription = 'calm';
        }
        
        return `The wind speed in ${weatherData.location} is ${wind} m/s, which is ${windDescription}.`;
    }
    
    // General weather questions
    if (questionLower.includes('how') && questionLower.includes('weather')) {
        return `The weather in ${weatherData.location} is ${weatherData.condition} with a temperature of ${weatherData.temperature}°C, humidity of ${weatherData.humidity}%, and wind speed of ${weatherData.wind} m/s.`;
    }
    
    // Default response
    return `I'm not sure about that specific question. The current weather in ${weatherData.location} is ${weatherData.condition} with a temperature of ${weatherData.temperature}°C.`;
}

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 