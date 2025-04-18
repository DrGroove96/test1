// API configuration
const OPENWEATHER_API_KEY = '879ea4a729df8bf05abea4e7e6f7c708';
const DEEPSEEK_API_KEY = 'sk-3794fb74c0614f68b21a6d919d98d9d8';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Firebase configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";
import { getDatabase, ref, child, get, push, onValue } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdHyJMIVTDrrIgJLz8DkUl9hlSHr3_i5I",
  authDomain: "ds440-capstone.firebaseapp.com",
  projectId: "ds440-capstone",
  storageBucket: "ds440-capstone.firebasestorage.app",
  messagingSenderId: "409978442047",
  appId: "1:409978442047:web:b0fbec040e5816aa40c38a",
  measurementId: "G-B5GSZYWXGV",
  databaseURL: "https://ds440-capstone-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);



// Global variables
let map;
let currentLocation = {
    lat: 40.7934,
    lon: -77.8600,
    name: 'State College'
};

// Global chart variables
let hourlyTempChart = null;
let dailyTempChart = null;
let precipitationChart = null;
let historicalChart = null;
let hourlyDistributionChart = null;

// User preferences
let userPreferences = {
    tempUnit: 'celsius',
    timeFormat: '24h',
    defaultLocation: 'State College'
};

// Add this to your global variables at the top
let userReportedTemps = [];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Remove the annotation plugin registration
    // Chart.register(ChartAnnotation);
    
    loadUserPreferences();
    initializeMap();
    initializeCharts();
    getCurrentLocation();
    listenForUserTemps();

    // Add event listeners for forecast type buttons
    document.getElementById('hourly').addEventListener('click', () => {
        document.getElementById('hourlyForecast').style.display = 'block';
        document.getElementById('dailyForecast').style.display = 'none';
        document.getElementById('hourly').classList.add('active');
        document.getElementById('daily').classList.remove('active');
    });

    document.getElementById('daily').addEventListener('click', () => {
        document.getElementById('hourlyForecast').style.display = 'none';
        document.getElementById('dailyForecast').style.display = 'block';
        document.getElementById('daily').classList.add('active');
        document.getElementById('hourly').classList.remove('active');
    });

    // Set initial active state
    document.getElementById('hourly').classList.add('active');
});

// Initialize map
function initializeMap() {
    map = L.map('map').setView([currentLocation.lat, currentLocation.lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (e) => {
        updateWeather(e.latlng.lat, e.latlng.lng);
    });
}

// Initialize charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: false
            }
        }
    };

    // Temperature Chart (Hourly)
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    hourlyTempChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'API Temperature (°C)',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    },
                    {
                        label: 'User Reported (°C)',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
                    },
                    {
                        label: 'Feels Like (°C)',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }
                ]
            },
            options: chartOptions
        });

    // Daily Temperature Chart
    const dailyTempCtx = document.getElementById('dailyTemperatureChart').getContext('2d');
    dailyTempChart = new Chart(dailyTempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '5-Day Temperature (°C)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: chartOptions
        });

    // Precipitation Chart
    const precipCtx = document.getElementById('precipitationChart').getContext('2d');
    precipitationChart = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Rain (mm)',
                        data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    },
                    {
                        label: 'Snow (mm)',
                        data: [],
                    backgroundColor: 'rgba(201, 203, 207, 0.5)'
                }
            ]
        },
        options: {
            ...chartOptions,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Historical Chart
    const historicalCtx = document.getElementById('historicalChart').getContext('2d');
    historicalChart = new Chart(historicalCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Daily Temperature (°C)',
                        data: [],
                    borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    },
                    {
                    label: 'Moving Average',
                        data: [],
                    borderColor: 'rgb(255, 159, 64)',
                    borderDash: [5, 5],
                        tension: 0.1,
                    fill: false
                },
                {
                    label: 'Temperature Trend',
                        data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    borderDash: [10, 5],
                    tension: 0.1,
                    fill: false
                    }
                ]
            },
            options: {
            ...chartOptions,
                plugins: {
                    title: {
                        display: true,
                    text: 'Historical Temperature Analysis'
                    }
                }
            }
        });
}

// Get current location
document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
function getCurrentLocation() {
    showLoading(true);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                updateWeather(position.coords.latitude, position.coords.longitude);
            },
            error => {
                console.error('Geolocation error:', error);
                updateWeather(currentLocation.lat, currentLocation.lon);
            }
        );
    } else {
        updateWeather(currentLocation.lat, currentLocation.lon);
    }
}

// Update weather data
async function updateWeather(lat, lon) {
    try {
        showLoading(true);
        
        // Clear user reported temperatures when location changes
        userReportedTemps = [];
        
        // Get location name first
        const locationResponse = await fetch(
            `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`
        );
        
        if (!locationResponse.ok) {
            throw new Error(`Location lookup failed: ${locationResponse.status}`);
        }
        
        const locationData = await locationResponse.json();
        
        if (!locationData || locationData.length === 0) {
            throw new Error('No location data found');
        }
        
        currentLocation = {
            lat: lat,
            lon: lon,
            name: locationData[0].name || 'Unknown Location'
        };

        // Get current weather
        const weatherResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
        );
        
        if (!weatherResponse.ok) {
            throw new Error(`Weather data fetch failed: ${weatherResponse.status}`);
        }
        
        const weatherData = await weatherResponse.json();
        
        if (!weatherData || !weatherData.main) {
            throw new Error('Invalid weather data received');
        }

        // Update UI elements
        updateWeatherUI(weatherData);
        
        // Get and update forecast data
        await updateForecastData(lat, lon);

    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError(`Failed to fetch weather data: ${error.message}`);
        
        // Reset to default location if there's an error
        currentLocation = {
            lat: 40.7934,
            lon: -77.8600,
            name: 'State College'
        };
        
        // Update UI to show error state
        document.getElementById('location').textContent = 'Error loading location';
        document.getElementById('temperature').textContent = '--°C';
        document.getElementById('feels-like').textContent = '--°C';
        document.getElementById('condition').textContent = 'Error';
        document.getElementById('low-high').textContent = '--°C/--°C';
        document.getElementById('humidity').textContent = '--%';
        document.getElementById('wind').textContent = '-- m/s';
        document.getElementById('pressure').textContent = '-- hPa';
        document.getElementById('visibility').textContent = '-- km';
        document.getElementById('uv-index').textContent = '--';
        
        // Clear charts
        if (hourlyTempChart) {
            hourlyTempChart.destroy();
            hourlyTempChart = null;
        }
        if (dailyTempChart) {
            dailyTempChart.destroy();
            dailyTempChart = null;
        }
        if (precipitationChart) {
            precipitationChart.destroy();
            precipitationChart = null;
        }
        if (historicalChart) {
            historicalChart.destroy();
            historicalChart = null;
        }
        if (temperatureTrendsChart) {
            temperatureTrendsChart.destroy();
            temperatureTrendsChart = null;
        }
        if (hourlyDistributionChart) {
            hourlyDistributionChart.destroy();
            hourlyDistributionChart = null;
        }
    } finally {
        showLoading(false);
    }
}

// Update weather UI
function updateWeatherUI(data) {
    document.getElementById('location').textContent = currentLocation.name;
    document.getElementById('temperature').textContent = formatTemperature(data.main.temp);
    document.getElementById('feels-like').textContent = formatTemperature(data.main.feels_like);
    document.getElementById('condition').textContent = data.weather[0].main;
    document.getElementById('low-high').textContent = 
        `${formatTemperature(data.main.temp_min)}/${formatTemperature(data.main.temp_max)}`;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = `${data.wind.speed} m/s`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
    document.getElementById('uv-index').textContent = '0'; // UV index not available in free API
    
    // Update weather icon
    const iconCode = data.weather[0].icon;
    document.getElementById('weatherIcon').src = 
        `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

    // Send weather data to server
    fetch('/api/update-weather', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            location: currentLocation.name,
            temperature: data.main.temp,
            condition: data.weather[0].main,
            humidity: data.main.humidity,
            wind: data.wind.speed,
            feelsLike: data.main.feels_like
        })
    }).catch(error => {
        console.error('Error updating weather data on server:', error);
    });
}

// Update temperature chart with user feedback
function updateTemperatureChart() {
    if (!hourlyTempChart) return;

    const currentData = hourlyTempChart.data;
    const lastIndex = currentData.labels.length - 1;
    
    // Add user reported temperature to the latest time point
    if (lastIndex >= 0) {
        const userTemp = parseFloat(document.getElementById('userTemperature').value);
        currentData.datasets[1].data[lastIndex] = userTemp;
        hourlyTempChart.update();
    }
}


// Write temperature feedback to Firebase database
function writeUserTemp(temp, timeDate, lat, lon) {
    const db = getDatabase();
    push(ref(db, 'users/'), {
      temperature: temp,
      time: timeDate,
      latitude : lat,
      longitude: lon
    });
  }

// Add this function to check and clear old reports
function clearOldTemperatureReports() {
    const userTemps = JSON.parse(localStorage.getItem('userTemperatures') || '[]');
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set to start of day
    
    // Filter out reports from previous days
    const todaysReports = userTemps.filter(report => {
        const reportDate = new Date(report.timestamp);
        reportDate.setHours(0, 0, 0, 0);  // Set to start of day
        return reportDate.getTime() === today.getTime();
    });
    
    localStorage.setItem('userTemperatures', JSON.stringify(todaysReports));
  }

// Temperature feedback submission
document.getElementById('submitTemp').addEventListener('click', async function() {
    // Clear old reports first
    clearOldTemperatureReports();
    
    const userTemp = parseFloat(document.getElementById('userTemperature').value);
    if (isNaN(userTemp)) {
        showError('Please enter a valid temperature');
        return;
    }

    try {
        // Get database reference
        const db = getDatabase();
        const userTempsRef = ref(db, 'users/');

        // Create timestamp in milliseconds
        const timestamp = Date.now();

        // Store the temperature locally first
        const userTemps = JSON.parse(localStorage.getItem('userTemperatures') || '[]');
        userTemps.push({
            temperature: userTemp,
            timestamp: timestamp
        });
        localStorage.setItem('userTemperatures', JSON.stringify(userTemps));

        // Push new temperature data to Firebase
        await push(userTempsRef, {
            temperature: userTemp,
            timestamp: timestamp,
            latitude: currentLocation.lat,
            longitude: currentLocation.lon,
            location: currentLocation.name
        });

        console.log('Temperature submitted:', {
            temp: userTemp,
            timestamp: timestamp,
            location: currentLocation.name,
            coords: `${currentLocation.lat},${currentLocation.lon}`
        });

        // Update the charts immediately
        updateForecastData(currentLocation.lat, currentLocation.lon);

        // Show success message
        const feedbackMessage = document.getElementById('feedbackMessage');
        feedbackMessage.textContent = 'Temperature reported successfully!';
        feedbackMessage.style.display = 'block';
        
        // Clear input
        document.getElementById('userTemperature').value = '';
        
        setTimeout(() => {
            feedbackMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error submitting temperature:', error);
        showError('Failed to submit temperature');
    }
});

// Add this to clear old reports when the page loads
window.addEventListener('load', clearOldTemperatureReports);

// Also clear old reports when updating the display
window.updateUserReportedTemperatures = function() {
    // Clear old reports first
    clearOldTemperatureReports();
    
    // Load from localStorage instead of API
    const userTemps = JSON.parse(localStorage.getItem('userTemperatures') || '[]');
    
    if (window.tempChart) {
        // Clear existing user reported data
        window.tempChart.data.datasets[2].data = new Array(window.tempChart.data.labels.length).fill(null);
        
        // Update with stored data
        userTemps.forEach(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            
            const index = window.tempChart.data.labels.indexOf(dateStr);
            if (index !== -1) {
                window.tempChart.data.datasets[2].data[index] = entry.temperature;
            }
        });
        
        window.tempChart.update();
    }
};

// Update forecast data
async function updateForecastData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
        );
        const data = await response.json();
        
        // Process hourly data
        const hourlyData = data.list.slice(0, 8);
        const hourlyLabels = hourlyData.map(item => formatTime(item.dt));

        // Get user reported temperatures
        const userTemps = JSON.parse(localStorage.getItem('userTemperatures') || '[]');
        
        // Calculate average temperature for each hour
        const hourlyUserTemps = hourlyLabels.map(label => {
            const hour = parseInt(label.split(':')[0]);
            const today = new Date();
            today.setHours(hour, 0, 0, 0);
            
            // Filter temperatures for this hour from today
            const temps = userTemps.filter(temp => {
                const tempDate = new Date(temp.timestamp);
                return tempDate.getHours() === hour && 
                       tempDate.getDate() === today.getDate();
            });
            
            if (temps.length > 0) {
                return temps.reduce((sum, temp) => sum + temp.temperature, 0) / temps.length;
            }
            return null;
        });

        // Create comparison container if it doesn't exist
        const chartContainer = document.querySelector('#hourlyForecast .chart-container');
        let comparisonContainer = document.querySelector('#hourlyForecast .comparison-container');
        
        if (!comparisonContainer) {
            comparisonContainer = document.createElement('div');
            comparisonContainer.className = 'comparison-container';
            comparisonContainer.innerHTML = `
                <div class="comparison-item">
                    <div class="comparison-label">API Temperature</div>
                    <div class="comparison-value" id="apiTempValue">--°C</div>
                </div>
                <div class="comparison-item">
                    <div class="comparison-label">Average User Report</div>
                    <div class="comparison-value" id="avgUserTemp">--°C</div>
                </div>
                <div class="comparison-item">
                    <div class="comparison-label">Total Reports</div>
                    <div class="comparison-value" id="totalReports">--</div>
                </div>
            `;
            chartContainer.parentNode.insertBefore(comparisonContainer, chartContainer.nextSibling);
        }

        // Get current API temperature
        const currentApiTemp = hourlyData[0].main.temp;
        document.getElementById('apiTempValue').textContent = `${currentApiTemp.toFixed(1)}°C`;

        // Calculate today's average user temperature
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTemps = userTemps.filter(temp => {
            const tempDate = new Date(temp.timestamp);
            tempDate.setHours(0, 0, 0, 0);
            return tempDate.getTime() === today.getTime();
        });
        
        const avgUserTemp = todayTemps.length > 0 
            ? todayTemps.reduce((sum, temp) => sum + temp.temperature, 0) / todayTemps.length 
            : null;

        // Update comparison container values
        document.getElementById('avgUserTemp').textContent = avgUserTemp ? `${avgUserTemp.toFixed(1)}°C` : '--°C';
        document.getElementById('totalReports').textContent = todayTemps.length;

        // Update hourly temperature chart
        if (hourlyTempChart) {
            hourlyTempChart.destroy();
        }
        
        const hourlyCtx = document.getElementById('temperatureChart').getContext('2d');
        hourlyTempChart = new Chart(hourlyCtx, {
            type: 'line',
            data: {
                labels: hourlyLabels,
                datasets: [
                    {
                        label: 'API Temperature (°C)',
                        data: hourlyData.map(item => item.main.temp),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true
                    },
                    {
                        label: 'Feels Like (°C)',
                        data: hourlyData.map(item => item.main.feels_like),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true
                    },
                    {
                        label: 'User Reported (°C)',
                        data: hourlyUserTemps,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(1) + '°C';
                                    if (context.dataset.label === 'User Reported (°C)') {
                                        label += ` (${todayTemps.length} reports today)`;
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Hourly Temperature Forecast',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });

        // Process 5-day forecast data
        const dailyData = [];
        for (let i = 0; i < data.list.length; i += 8) {
            dailyData.push(data.list[i]);
        }
        const dailyLabels = dailyData.map(item => formatDate(item.dt));

        // Update daily temperature chart
        if (dailyTempChart) {
            dailyTempChart.destroy();
        }
        
        const dailyCtx = document.getElementById('dailyTemperatureChart').getContext('2d');
        dailyTempChart = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: dailyLabels,
                datasets: [
                    {
                        label: 'API Temperature (°C)',
                        data: dailyData.map(item => item.main.temp),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true
                    },
                    {
                        label: 'Feels Like (°C)',
                        data: dailyData.map(item => item.main.feels_like),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true
                    },
                    {
                        label: 'User Average (°C)',
                        data: dailyLabels.map(() => avgUserTemp),
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderWidth: 2,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(1) + '°C';
                                    if (context.dataset.label === 'User Average (°C)') {
                                        label += ` (Based on ${userReportedTemps.length} reports)`;
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: '5-Day Temperature Forecast',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });

        // Update precipitation chart
        if (precipitationChart) {
            precipitationChart.destroy();
        }
        
        const precipCtx = document.getElementById('precipitationChart').getContext('2d');
        precipitationChart = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: hourlyLabels,
                datasets: [
                    {
                        label: 'Rain (mm)',
                        data: hourlyData.map(item => item.rain ? item.rain['3h'] : 0),
                        backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    },
                    {
                        label: 'Snow (mm)',
                        data: hourlyData.map(item => item.snow ? item.snow['3h'] : 0),
                        backgroundColor: 'rgba(201, 203, 207, 0.5)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 50  // Add padding at the top
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Precipitation (mm)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Precipitation Analysis',
                        font: {
                            size: 16,
                            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                        },
                        padding: {
                            top: 30,  // Increase top padding for the title
                            bottom: 10
                        }
                    }
                }
            }
        });

        // After updating all charts, ensure the correct forecast section is visible
        const activeButton = document.querySelector('.forecast-type-btn.active');
        if (activeButton) {
            if (activeButton.id === 'hourly') {
                document.getElementById('hourlyForecast').style.display = 'block';
                document.getElementById('dailyForecast').style.display = 'none';
            } else {
                document.getElementById('hourlyForecast').style.display = 'none';
                document.getElementById('dailyForecast').style.display = 'block';
            }
        }

    } catch (error) {
        console.error('Error updating forecast:', error);
    }
}

// Create historical analysis visualization
function createHistoricalAnalysis(historicalUserTemps) {
    try {
        // Validate input data
        if (!Array.isArray(historicalUserTemps) || historicalUserTemps.length === 0) {
            console.log('No historical temperature data available');
            return;
        }

        // Group historical temperatures by date
        const tempsByDate = {};
        
        historicalUserTemps.forEach(temp => {
            if (!temp || typeof temp.temperature !== 'number' || !temp.timestamp) {
                console.log('Invalid temperature data point:', temp);
                return;
            }

            const date = new Date(temp.timestamp);
            const dateStr = formatDate(date.getTime() / 1000);
            
            if (!tempsByDate[dateStr]) {
                tempsByDate[dateStr] = [];
            }
            tempsByDate[dateStr].push(temp.temperature);
        });

        // Get all available dates and sort them
        const availableDates = Object.keys(tempsByDate).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateA - dateB;
        });

        // Calculate statistics for each date
        const historicalData = availableDates.map(date => {
            const temps = tempsByDate[date].filter(t => !isNaN(t));
            
            if (temps.length === 0) return null;

            const min = Math.min(...temps);
            const max = Math.max(...temps);
            const stdDev = calculateStandardDeviation(temps);
            const mean = calculateAverage(temps);

            return {
                date,
                min,
                max,
                stdDev,
                mean,
                count: temps.length
            };
        }).filter(data => data !== null);

        // Update the historical analysis section
        const historicalSection = document.querySelector('.historical-section');
        if (historicalSection) {
            // Remove any existing stats
            const existingStats = historicalSection.querySelector('.historical-stats');
            if (existingStats) {
                existingStats.remove();
            }

            // Update the historical chart
            updateHistoricalChart();
        }

        console.log('Historical analysis updated');
    } catch (error) {
        console.error('Error updating historical analysis:', error);
    }
}

// Helper function to calculate mode
function calculateMode(values) {
    const counts = {};
    let maxCount = 0;
    let mode = values[0];

    values.forEach(value => {
        counts[value] = (counts[value] || 0) + 1;
        if (counts[value] > maxCount) {
            maxCount = counts[value];
            mode = value;
        }
    });

    return mode;
}

// Helper function to calculate variance
function calculateVariance(values) {
    const mean = calculateAverage(values);
    const squareDiffs = values.map(value => {
        const diff = value - mean;
        return diff * diff;
    });
    return calculateAverage(squareDiffs);
}

// Helper function to calculate standard deviation
function calculateStandardDeviation(values) {
    const avg = calculateAverage(values);
    const squareDiffs = values.map(value => {
        const diff = value - avg;
        return diff * diff;
    });
    const avgSquareDiff = calculateAverage(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

// Helper function to calculate average
function calculateAverage(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Helper function to calculate linear regression
function calculateLinearRegression(points) {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    points.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// Helper function to format dates consistently
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

// Update chart data helper function
function updateChartData(chart, newData) {
    if (chart) {
        chart.data = newData;
        chart.update();
    }
}

// Format helpers
function formatTemperature(temp) {
    if (userPreferences.tempUnit === 'fahrenheit') {
        temp = (temp * 9/5) + 32;
    }
    return `${Math.round(temp)}°${userPreferences.tempUnit === 'celsius' ? 'C' : 'F'}`;
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    if (userPreferences.timeFormat === '24h') {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

// UI helpers
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    // Implement error display
    console.error(message);
}

// Settings functions
document.getElementById('toggleSettings').addEventListener('click', toggleSettings);
function toggleSettings() {
    document.getElementById('settingsPanel').classList.toggle('active');
}

document.getElementById('saveSettings').addEventListener('click', saveSettings);
function saveSettings() {
    userPreferences = {
        tempUnit: document.getElementById('tempUnit').value,
        timeFormat: document.getElementById('timeFormat').value,
        defaultLocation: document.getElementById('defaultLocation').value
    };
    localStorage.setItem('weatherPreferences', JSON.stringify(userPreferences));
    document.getElementById('settingsPanel').classList.remove('active');
    updateWeather(currentLocation.lat, currentLocation.lon);
}

function loadUserPreferences() {
    const saved = localStorage.getItem('weatherPreferences');
    if (saved) {
        userPreferences = JSON.parse(saved);
        document.getElementById('tempUnit').value = userPreferences.tempUnit;
        document.getElementById('timeFormat').value = userPreferences.timeFormat;
        document.getElementById('defaultLocation').value = userPreferences.defaultLocation;
    }
}

// Update the Firebase listener function to properly aggregate all user data
function listenForUserTemps() {
    console.log('Starting Firebase listener');
    const db = getDatabase();
    const userTempsRef = ref(db, 'users/');

    onValue(userTempsRef, (snapshot) => {
        console.log('Firebase data updated');
        const data = snapshot.val();
        console.log('Raw Firebase data:', data);

        if (!data) {
            console.log('No data in Firebase');
            return;
        }

        // Clear existing user reported temps
        userReportedTemps = [];

        // Convert all Firebase data to our format
        Object.values(data).forEach(entry => {
            // Check if entry has the required data
            if (entry.temperature && entry.time && entry.latitude && entry.longitude) {
                // Check if the location is close to current location (within ~1km radius)
                if (Math.abs(entry.latitude - currentLocation.lat) < 0.01 && 
                    Math.abs(entry.longitude - currentLocation.lon) < 0.01) {
                    
                    userReportedTemps.push({
                        timestamp: new Date(entry.time).getTime(),
                        temperature: parseFloat(entry.temperature)
                    });
                    console.log('Added temperature point:', {
                        temp: entry.temperature,
                        time: entry.time,
                        location: `${entry.latitude},${entry.longitude}`
                    });
                }
            }
        });

        // Sort by timestamp
        userReportedTemps.sort((a, b) => a.timestamp - b.timestamp);
        console.log('Total user reported temperatures:', userReportedTemps.length);

        // Update the visualization immediately
        if (userReportedTemps.length > 0) {
            console.log('Updating forecast with user data');
            updateForecastData(currentLocation.lat, currentLocation.lon);
            updateHistoricalAnalysis(userReportedTemps);
        }
    });
}

// Helper function to calculate median
function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

// Helper function to calculate quartiles
function calculateQuartiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return { q1, q3 };
}

// Helper function to calculate skewness
function calculateSkewness(values) {
    const mean = calculateAverage(values);
    const stdDev = calculateStandardDeviation(values);
    const cubedDiffs = values.map(value => Math.pow((value - mean) / stdDev, 3));
    return calculateAverage(cubedDiffs);
}

// Helper function to calculate kurtosis
function calculateKurtosis(values) {
    const mean = calculateAverage(values);
    const stdDev = calculateStandardDeviation(values);
    const fourthPowerDiffs = values.map(value => Math.pow((value - mean) / stdDev, 4));
    return calculateAverage(fourthPowerDiffs) - 3;
}

// Helper function to calculate date range
function calculateDateRange(temperatures) {
    if (!temperatures || temperatures.length === 0) return 'No data';
    
    const dates = temperatures.map(temp => new Date(temp.timestamp));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    const minDateStr = minDate.toLocaleDateString([], {month: 'short', day: 'numeric'});
    const maxDateStr = maxDate.toLocaleDateString([], {month: 'short', day: 'numeric'});
    
    return `${minDateStr} to ${maxDateStr}`;
}

// Helper function to calculate temperature variability
function calculateTemperatureVariability(historicalData) {
    if (!historicalData || historicalData.length === 0) return { high: 0, medium: 0, low: 0 };
    
    const variabilities = historicalData.map(day => ({
        date: day.date,
        range: day.max - day.min,
        stdDev: day.stdDev
    }));
    
    // Sort by range
    variabilities.sort((a, b) => b.range - a.range);
    
    // Calculate thresholds for high/medium/low variability
    const maxRange = variabilities[0].range;
    const highThreshold = maxRange * 0.7;
    const mediumThreshold = maxRange * 0.4;
    
    return {
        high: variabilities.filter(v => v.range >= highThreshold).length,
        medium: variabilities.filter(v => v.range >= mediumThreshold && v.range < highThreshold).length,
        low: variabilities.filter(v => v.range < mediumThreshold).length
    };
}

// Helper function to calculate daily temperature pattern
function calculateDailyPattern(tempsByHour) {
    if (!tempsByHour || Object.keys(tempsByHour).length === 0) {
        return {
            warmestHour: '--',
            warmestTemp: 0,
            coolestHour: '--',
            coolestTemp: 0,
            range: 0
        };
    }
    
    // Calculate average temperature for each hour
    const hourlyAverages = {};
    Object.keys(tempsByHour).forEach(hour => {
        const temps = tempsByHour[hour];
        hourlyAverages[hour] = calculateAverage(temps);
    });
    
    // Find warmest and coolest hours
    let warmestHour = 0;
    let warmestTemp = -Infinity;
    let coolestHour = 0;
    let coolestTemp = Infinity;
    
    Object.keys(hourlyAverages).forEach(hour => {
        const temp = hourlyAverages[hour];
        if (temp > warmestTemp) {
            warmestTemp = temp;
            warmestHour = parseInt(hour);
        }
        if (temp < coolestTemp) {
            coolestTemp = temp;
            coolestHour = parseInt(hour);
        }
    });
    
    return {
        warmestHour,
        warmestTemp,
        coolestHour,
        coolestTemp,
        range: warmestTemp - coolestTemp
    };
}

// Helper function to find temperature anomalies
function findTemperatureAnomalies(data, providedAvg, providedStdDev) {
    // Handle empty data
    if (!data || data.length === 0) {
        return {
            highCount: 0,
            lowCount: 0,
            mostVariableDay: null,
            mostVariableRange: 0,
            mostStableDay: null,
            mostStableRange: 0,
            unusualHighs: 'None detected',
            unusualLows: 'None detected',
            variableDay: 'Insufficient data'
        };
    }
    
    // Determine data format and calculate statistics if not provided
    let mean, stdDev, temperatures, historicalData;
    
    if (data[0].hasOwnProperty('max') && data[0].hasOwnProperty('min')) {
        // Historical data format with daily max/min
        historicalData = data;
        mean = providedAvg || calculateAverage(data.map(day => (day.max + day.min) / 2));
        stdDev = providedStdDev || calculateStandardDeviation(data.map(day => (day.max + day.min) / 2));
        
        // Define anomaly thresholds (2 standard deviations from mean)
        const highThreshold = mean + (2 * stdDev);
        const lowThreshold = mean - (2 * stdDev);
        
        // Count days with unusually high or low temperatures
        const highCount = historicalData.filter(day => day.max > highThreshold).length;
        const lowCount = historicalData.filter(day => day.min < lowThreshold).length;
        
        // Find most variable and most stable days
        let mostVariableDay = null;
        let mostVariableRange = 0;
        let mostStableDay = null;
        let mostStableRange = Infinity;
        
        historicalData.forEach(day => {
            const range = day.max - day.min;
            if (range > mostVariableRange) {
                mostVariableRange = range;
                mostVariableDay = day.date;
            }
            if (range < mostStableRange) {
                mostStableRange = range;
                mostStableDay = day.date;
            }
        });
        
        // Format strings for UI
        const unusualHighs = highCount > 0 ? 
            `${highCount} days above ${highThreshold.toFixed(1)}°C` : 
            'None detected';
        const unusualLows = lowCount > 0 ? 
            `${lowCount} days below ${lowThreshold.toFixed(1)}°C` : 
            'None detected';
        const variableDay = mostVariableDay ? 
            `${mostVariableDay} (range = ${mostVariableRange.toFixed(1)}°C)` : 
            'Insufficient data';
        
        return {
            highCount,
            lowCount,
            mostVariableDay,
            mostVariableRange,
            mostStableDay,
            mostStableRange,
            unusualHighs,
            unusualLows,
            variableDay
        };
    } else {
        // Array of temperature readings
        temperatures = data;
        mean = providedAvg || calculateAverage(temperatures.map(t => t.temperature));
        stdDev = providedStdDev || calculateStandardDeviation(temperatures.map(t => t.temperature));
        
        const unusualHighs = temperatures.filter(t => 
            t.temperature > mean + 2 * stdDev
        ).map(t => ({
            temp: t.temperature,
            time: new Date(t.timestamp).toLocaleString()
        }));
        
        const unusualLows = temperatures.filter(t => 
            t.temperature < mean - 2 * stdDev
        ).map(t => ({
            temp: t.temperature,
            time: new Date(t.timestamp).toLocaleString()
        }));
        
        // Find most variable day
        const dailyVariances = new Map();
        temperatures.forEach(t => {
            const day = new Date(t.timestamp).toDateString();
            if (!dailyVariances.has(day)) {
                dailyVariances.set(day, []);
            }
            dailyVariances.get(day).push(t.temperature);
        });
        
        let maxVariance = 0;
        let variableDay = '';
        dailyVariances.forEach((temps, day) => {
            const variance = calculateStandardDeviation(temps);
            if (variance > maxVariance) {
                maxVariance = variance;
                variableDay = day;
            }
        });
        
        // Calculate counts for historical format compatibility
        const highCount = unusualHighs.length;
        const lowCount = unusualLows.length;
        
        return {
            highCount,
            lowCount,
            mostVariableDay: variableDay ? new Date(variableDay).toLocaleDateString() : null,
            mostVariableRange: maxVariance,
            mostStableDay: null,
            mostStableRange: 0,
            unusualHighs: unusualHighs.length > 0 ? 
                `${unusualHighs.length} readings above ${(mean + 2 * stdDev).toFixed(1)}°C` : 
                'None detected',
            unusualLows: unusualLows.length > 0 ? 
                `${unusualLows.length} readings below ${(mean - 2 * stdDev).toFixed(1)}°C` : 
                'None detected',
            variableDay: variableDay ? 
                `${new Date(variableDay).toLocaleDateString()} (σ = ${maxVariance.toFixed(1)}°C)` : 
                'Insufficient data'
        };
    }
}

function calculateTemperatureInsights(temperatures) {
    if (!temperatures || temperatures.length === 0) {
        return null;
    }

    // Sort temperatures by timestamp
    const sortedTemps = [...temperatures].sort((a, b) => a.timestamp - b.timestamp);
    
    // Basic Statistics
    const avgTemp = calculateAverage(sortedTemps.map(t => t.temperature));
    const minTemp = Math.min(...sortedTemps.map(t => t.temperature));
    const maxTemp = Math.max(...sortedTemps.map(t => t.temperature));
    const stdDev = calculateStandardDeviation(sortedTemps.map(t => t.temperature));
    
    // Temperature Trends
    const trend = calculateTrend(sortedTemps);
    const trendStrength = calculateTrendStrength(sortedTemps, trend);
    const stability = calculateTemperatureStability(sortedTemps);
    
    // Daily Patterns
    const dailyPatterns = analyzeDailyPatterns(sortedTemps);
    const warmestTime = dailyPatterns.warmestTime;
    const coolestTime = dailyPatterns.coolestTime;
    const dailyRange = dailyPatterns.dailyRange;
    
    // Data Coverage
    const totalReports = sortedTemps.length;
    const dateRange = {
        start: new Date(sortedTemps[0].timestamp),
        end: new Date(sortedTemps[sortedTemps.length - 1].timestamp)
    };
    const daysWithReports = calculateDaysWithReports(sortedTemps);
    
    // Temperature Anomalies
    const anomalies = findTemperatureAnomalies(sortedTemps);
    
    return {
        basicStats: {
            average: avgTemp,
            min: minTemp,
            max: maxTemp,
            range: `${minTemp.toFixed(1)}°C to ${maxTemp.toFixed(1)}°C`,
            stdDev: stdDev
        },
        trends: {
            direction: trend.direction,
            strength: trendStrength,
            stability: stability
        },
        dailyPatterns: {
            warmestTime: warmestTime,
            coolestTime: coolestTime,
            dailyRange: dailyRange
        },
        coverage: {
            totalReports: totalReports,
            dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
            daysWithReports: daysWithReports
        },
        anomalies: anomalies
    };
}

function calculateTrend(temperatures) {
    const n = temperatures.length;
    if (n < 2) return { direction: 'Insufficient data', slope: 0 };
    
    const xMean = (n - 1) / 2;
    const yMean = calculateAverage(temperatures.map(t => t.temperature));
    
    let numerator = 0;
    let denominator = 0;
    
    temperatures.forEach((t, i) => {
        numerator += (i - xMean) * (t.temperature - yMean);
        denominator += Math.pow(i - xMean, 2);
    });
    
    const slope = numerator / denominator;
    
    let direction;
    if (Math.abs(slope) < 0.01) {
        direction = 'Stable';
    } else if (slope > 0) {
        direction = 'Rising';
    } else {
        direction = 'Falling';
    }
    
    return { direction, slope };
}

// Calculate R-squared value for trend strength
function calculateRSquared(temperatures, slope) {
    const n = temperatures.length;
    if (n < 2) return 0;
    
    const yMean = calculateAverage(temperatures.map(t => t.temperature));
    const xMean = (n - 1) / 2;
    
    let totalSS = 0;
    let residualSS = 0;
    
    temperatures.forEach((t, i) => {
        const y = t.temperature;
        const yPred = slope * (i - xMean) + yMean;
        
        totalSS += Math.pow(y - yMean, 2);
        residualSS += Math.pow(y - yPred, 2);
    });
    
    return 1 - (residualSS / totalSS);
}

function calculateTrendStrength(temperatures, trend) {
    if (temperatures.length < 2) return 'Insufficient data';
    
    const rSquared = calculateRSquared(temperatures, trend.slope);
    
    if (rSquared > 0.7) return 'Strong';
    if (rSquared > 0.3) return 'Moderate';
    return 'Weak';
}

function analyzeDailyPatterns(temperatures) {
    const hourlyTemps = new Array(24).fill().map(() => []);
    
    temperatures.forEach(t => {
        const hour = new Date(t.timestamp).getHours();
        hourlyTemps[hour].push(t.temperature);
    });
    
    const hourlyAverages = hourlyTemps.map(temps => 
        temps.length > 0 ? calculateAverage(temps) : null
    );
    
    const warmestHour = hourlyAverages.indexOf(Math.max(...hourlyAverages.filter(t => t !== null)));
    const coolestHour = hourlyAverages.indexOf(Math.min(...hourlyAverages.filter(t => t !== null)));
    
    return {
        warmestTime: `${warmestHour}:00`,
        coolestTime: `${coolestHour}:00`,
        dailyRange: Math.max(...hourlyAverages.filter(t => t !== null)) - 
                   Math.min(...hourlyAverages.filter(t => t !== null))
    };
}

function calculateDaysWithReports(temperatures) {
    const uniqueDays = new Set(
        temperatures.map(t => new Date(t.timestamp).toDateString())
    );
    return uniqueDays.size;
}

function calculateTemperatureStability(data) {
    if (!data || data.length === 0) return 'Insufficient data';
    
    let stdDev, range;
    
    if (data[0].hasOwnProperty('max') && data[0].hasOwnProperty('min')) {
        // Historical data format with daily max/min
        const dailyRanges = data.map(day => day.max - day.min);
        stdDev = calculateStandardDeviation(dailyRanges);
        range = Math.max(...data.map(day => day.max)) - Math.min(...data.map(day => day.min));
    } else {
        // Array of temperature readings
        const temperatures = data.map(t => t.temperature);
        stdDev = calculateStandardDeviation(temperatures);
        range = Math.max(...temperatures) - Math.min(...temperatures);
    }
    
    const stabilityIndex = stdDev / range;
    
    if (stabilityIndex < 0.1) return 'Very Stable';
    if (stabilityIndex < 0.2) return 'Stable';
    if (stabilityIndex < 0.3) return 'Moderate';
    return 'Variable';
}

function updateTemperatureInsights(insights) {
    if (!insights) return;
    
    // Update Basic Statistics
    const avgTemp = document.getElementById('avg-temp');
    const tempRange = document.getElementById('temp-range');
    const stdDev = document.getElementById('std-dev');
    
    if (avgTemp) avgTemp.textContent = `${insights.basicStats.average.toFixed(1)}°C`;
    if (tempRange) tempRange.textContent = insights.basicStats.range;
    if (stdDev) stdDev.textContent = `${insights.basicStats.stdDev.toFixed(1)}°C`;
    
    // Update Temperature Trends
    const tempTrend = document.getElementById('temp-trend');
    const trendStrength = document.getElementById('trend-strength');
    const tempStability = document.getElementById('temp-stability');
    
    if (tempTrend) tempTrend.textContent = insights.trends.direction;
    if (trendStrength) trendStrength.textContent = insights.trends.strength;
    if (tempStability) tempStability.textContent = insights.trends.stability;
    
    // Update Daily Patterns
    const warmestHour = document.getElementById('warmest-hour');
    const coolestHour = document.getElementById('coolest-hour');
    const dailyRange = document.getElementById('daily-range');
    
    if (warmestHour) warmestHour.textContent = insights.dailyPatterns.warmestTime;
    if (coolestHour) coolestHour.textContent = insights.dailyPatterns.coolestTime;
    if (dailyRange) dailyRange.textContent = `${insights.dailyPatterns.dailyRange.toFixed(1)}°C`;
    
    // Update Data Coverage
    const totalReports = document.getElementById('total-reports');
    const dateRange = document.getElementById('date-range');
    const daysWithReports = document.getElementById('days-with-reports');
    
    if (totalReports) totalReports.textContent = insights.coverage.totalReports;
    if (dateRange) dateRange.textContent = insights.coverage.dateRange;
    if (daysWithReports) daysWithReports.textContent = insights.coverage.daysWithReports;
    
    // Update Temperature Anomalies
    const unusualHighs = document.getElementById('unusual-highs');
    const unusualLows = document.getElementById('unusual-lows');
    const variableDay = document.getElementById('variable-day');
    
    if (unusualHighs) unusualHighs.textContent = insights.anomalies.unusualHighs;
    if (unusualLows) unusualLows.textContent = insights.anomalies.unusualLows;
    if (variableDay) variableDay.textContent = insights.anomalies.variableDay;
}

// Add a new function to update the historical chart
function updateHistoricalChart() {
    if (!historicalChart || !userReportedTemps.length) return;
    
    // Group temperatures by date
    const dailyTemps = {};
    userReportedTemps.forEach(temp => {
        const date = new Date(temp.timestamp).toLocaleDateString();
        if (!dailyTemps[date]) {
            dailyTemps[date] = [];
        }
        dailyTemps[date].push(temp.temperature);
    });
    
    // Calculate daily statistics
    const dates = Object.keys(dailyTemps).sort();
    const dailyStats = dates.map(date => {
        const temps = dailyTemps[date].filter(t => !isNaN(t));
        const min = Math.min(...temps);
        const max = Math.max(...temps);
        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        const stdDev = calculateStandardDeviation(temps);
        const { q1, q3 } = calculateQuartiles(temps);
        const iqr = q3 - q1;
        const skewness = calculateSkewness(temps);
        const kurtosis = calculateKurtosis(temps);
        
        return {
            date,
            min,
            max,
            avg,
            stdDev,
            q1,
            q3,
            iqr,
            skewness,
            kurtosis,
            count: temps.length
        };
    });

    // Calculate regression lines for min, max, and avg
    const minRegression = calculateTrendLine(dailyStats.map((d, i) => ({ x: i, y: d.min })));
    const maxRegression = calculateTrendLine(dailyStats.map((d, i) => ({ x: i, y: d.max })));
    const avgRegression = calculateTrendLine(dailyStats.map((d, i) => ({ x: i, y: d.avg })));

    // Calculate R-squared values for each regression
    const minRSquared = calculateRSquared(dailyStats.map(d => d.min), minRegression.slope);
    const maxRSquared = calculateRSquared(dailyStats.map(d => d.max), maxRegression.slope);
    const avgRSquared = calculateRSquared(dailyStats.map(d => d.avg), avgRegression.slope);

    // Calculate correlation between min and max temperatures
    const correlation = calculateCorrelation(
        dailyStats.map(d => d.min),
        dailyStats.map(d => d.max)
    );

    // Calculate temperature insights
    const insights = calculateTemperatureInsights(userReportedTemps);
    if (insights) {
        updateTemperatureInsights(insights);
    }

    // Create annotations for key metrics
    const annotations = {
        minTrend: {
            type: 'line',
            xMin: 0,
            xMax: dates.length - 1,
            yMin: minRegression.start,
            yMax: minRegression.end,
            borderColor: 'rgba(54, 162, 235, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                content: `Min Trend: ${minRegression.slope > 0 ? '↑' : '↓'} ${Math.abs(minRegression.slope).toFixed(2)}°C/day (R²: ${minRSquared.toFixed(2)})`,
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                font: {
                    size: 12,
                    weight: 'bold'
                }
            }
        },
        maxTrend: {
            type: 'line',
            xMin: 0,
            xMax: dates.length - 1,
            yMin: maxRegression.start,
            yMax: maxRegression.end,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                content: `Max Trend: ${maxRegression.slope > 0 ? '↑' : '↓'} ${Math.abs(maxRegression.slope).toFixed(2)}°C/day (R²: ${maxRSquared.toFixed(2)})`,
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                font: {
                    size: 12,
                    weight: 'bold'
                }
            }
        },
        stats: {
            type: 'label',
            xValue: dates[0],
            yValue: dailyStats[0].max,
            backgroundColor: 'rgba(75, 192, 192, 0.8)',
            content: `Stats: σ=${dailyStats[0].stdDev.toFixed(1)}°C | IQR=${dailyStats[0].iqr.toFixed(1)}°C | r=${correlation.toFixed(2)}`,
            font: {
                size: 12,
                weight: 'bold'
            },
            padding: 6,
            borderRadius: 4
        },
        distribution: {
            type: 'label',
            xValue: dates[0],
            yValue: dailyStats[0].min,
            backgroundColor: 'rgba(153, 102, 255, 0.8)',
            content: `Distribution: Skew=${dailyStats[0].skewness.toFixed(2)} | Kurt=${dailyStats[0].kurtosis.toFixed(2)}`,
            font: {
                size: 12,
                weight: 'bold'
            },
            padding: 6,
            borderRadius: 4
        }
    };

    // Update chart with new configuration
    historicalChart.data = {
        labels: dates,
        datasets: [
            {
                label: 'Temperature Range',
                data: dailyStats.map(stat => ({
                    y: stat.avg,
                    yMin: stat.min,
                    yMax: stat.max
                })),
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                type: 'line'
            },
            {
                label: 'Minimum Temperature',
                data: dailyStats.map(d => d.min),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.1
            },
            {
                label: 'Maximum Temperature',
                data: dailyStats.map(d => d.max),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.1
            },
            {
                label: 'Min Regression',
                data: dates.map((_, i) => minRegression.start + (minRegression.slope * i)),
                borderColor: 'rgba(54, 162, 235, 0.8)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            },
            {
                label: 'Max Regression',
                data: dates.map((_, i) => maxRegression.start + (maxRegression.slope * i)),
                borderColor: 'rgba(255, 99, 132, 0.8)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }
        ]
    };

    historicalChart.options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        layout: {
            padding: {
                top: 20,
                right: 20,
                bottom: 20,
                left: 20
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Temperature (°C)',
                    font: {
                        size: 14,
                        weight: 'bold',
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    },
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 12
                    },
                    padding: 10
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date',
                    font: {
                        size: 14,
                        weight: 'bold',
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    },
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 12
                    },
                    padding: 10
                }
            }
        },
        plugins: {
            title: {
                display: true,
                text: 'Historical Temperature Analysis',
                font: {
                    size: 14,
                    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                    weight: 'normal'
                },
                padding: {
                    top: 10,
                    bottom: 20
                }
            },
            legend: {
                position: 'top',
                align: 'center',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12,
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    },
                    boxWidth: 8,
                    boxHeight: 8
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: '#ddd',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(1) + '°C';
                            
                            // Add additional info for temperature range
                            if (context.dataset.label === 'Temperature Range') {
                                const date = context.label;
                                const stats = dailyStats[context.dataIndex];
                                label += ` (Range: ${stats.min.toFixed(1)}°C to ${stats.max.toFixed(1)}°C)`;
                                label += `\nσ: ${stats.stdDev.toFixed(1)}°C | IQR: ${stats.iqr.toFixed(1)}°C`;
                            }
                        }
                        return label;
                    }
                }
            },
            annotation: {
                annotations: annotations
            }
        }
    };

    historicalChart.update();
}

// Helper function to calculate trend line
function calculateTrendLine(points) {
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    points.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return {
        slope,
        intercept,
        start: intercept,
        end: intercept + (slope * (n - 1))
    };
}

// Helper function to calculate correlation coefficient
function calculateCorrelation(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return numerator / denominator;
}

// Create advanced visualizations
function createAdvancedVisualizations(temperatures) {
    if (!temperatures || temperatures.length === 0) {
        console.log('No temperature data available for advanced visualizations');
        return;
    }

    // Destroy existing charts if they exist
    const existingCharts = [
        'temperatureHeatmap',
        'temperatureBoxplot',
        'temperatureViolin',
        'temperatureScatter'
    ];

    existingCharts.forEach(chartId => {
        const existingChart = Chart.getChart(chartId);
        if (existingChart) {
            existingChart.destroy();
        }
    });

    // Group temperatures by hour and day
    const tempsByHour = {};
    const tempsByDay = {};
    
    temperatures.forEach(temp => {
        const date = new Date(temp.timestamp);
        const hour = date.getHours();
        const day = date.toLocaleDateString();
        
        if (!tempsByHour[hour]) {
            tempsByHour[hour] = [];
        }
        if (!tempsByDay[day]) {
            tempsByDay[day] = [];
        }
        
        tempsByHour[hour].push(temp.temperature);
        tempsByDay[day].push(temp.temperature);
    });

    // Create visualizations
    createHeatmap(tempsByHour);
    createBoxplot(tempsByHour);
    createViolinPlot(tempsByHour);
    createScatterPlot(temperatures);
}

// Create heatmap visualization
function createHeatmap(tempsByHour) {
    const ctx = document.getElementById('temperatureHeatmap');
    if (!ctx) return;

    const hours = Object.keys(tempsByHour).sort((a, b) => Number(a) - Number(b));
    const data = hours.map(hour => {
        const temps = tempsByHour[hour];
        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        return {
            x: hour,
            y: 'Temperature',
            v: avg
        };
    });

    new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                data: data,
                backgroundColor(context) {
                    const value = context.dataset.data[context.dataIndex].v;
                    const alpha = (value - Math.min(...data.map(d => d.v))) / 
                                (Math.max(...data.map(d => d.v)) - Math.min(...data.map(d => d.v)));
                    return `rgba(255, 99, 132, ${alpha})`;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title() {
                            return '';
                        },
                        label(context) {
                            const v = context.dataset.data[context.dataIndex].v;
                            return `Hour: ${context.dataset.data[context.dataIndex].x}:00\nTemperature: ${v.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: hours.map(h => `${h}:00`),
                    title: {
                        display: true,
                        text: 'Hour of Day'
                    }
                },
                y: {
                    type: 'category',
                    labels: ['Temperature'],
                    title: {
                        display: true,
                        text: 'Metric'
                    }
                }
            }
        }
    });
}

// Create boxplot visualization
function createBoxplot(tempsByHour) {
    const ctx = document.getElementById('temperatureBoxplot');
    if (!ctx) return;

    const hours = Object.keys(tempsByHour).sort((a, b) => Number(a) - Number(b));
    const data = hours.map(hour => tempsByHour[hour]);

    new Chart(ctx, {
        type: 'boxplot',
        data: {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
                label: 'Temperature Distribution',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Distribution by Hour'
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const stats = context.dataset.data[context.dataIndex];
                            return [
                                `Min: ${stats.min.toFixed(1)}°C`,
                                `Q1: ${stats.q1.toFixed(1)}°C`,
                                `Median: ${stats.median.toFixed(1)}°C`,
                                `Q3: ${stats.q3.toFixed(1)}°C`,
                                `Max: ${stats.max.toFixed(1)}°C`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Day'
                    }
                }
            }
        }
    });
}

// Create violin plot visualization
function createViolinPlot(tempsByHour) {
    const ctx = document.getElementById('temperatureViolin');
    if (!ctx) return;

    const hours = Object.keys(tempsByHour).sort((a, b) => Number(a) - Number(b));
    const data = hours.map(hour => tempsByHour[hour]);

    new Chart(ctx, {
        type: 'violin',
        data: {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
                label: 'Temperature Distribution',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgb(75, 192, 192)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Distribution by Hour'
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const stats = context.dataset.data[context.dataIndex];
                            return [
                                `Min: ${stats.min.toFixed(1)}°C`,
                                `Q1: ${stats.q1.toFixed(1)}°C`,
                                `Median: ${stats.median.toFixed(1)}°C`,
                                `Q3: ${stats.q3.toFixed(1)}°C`,
                                `Max: ${stats.max.toFixed(1)}°C`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Day'
                    }
                }
            }
        }
    });
}

// Create scatter plot visualization
function createScatterPlot(temperatures) {
    const ctx = document.getElementById('temperatureScatter');
    if (!ctx) return;

    const data = temperatures.map(temp => ({
        x: new Date(temp.timestamp),
        y: temp.temperature
    }));

    // Calculate regression line
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach(point => {
        sumX += point.x.getTime();
        sumY += point.y;
        sumXY += point.x.getTime() * point.y;
        sumXX += point.x.getTime() * point.x.getTime();
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const regressionLine = data.map(point => ({
        x: point.x,
        y: slope * point.x.getTime() + intercept
    }));

    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Temperature Readings',
                data: data,
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            }, {
                label: 'Trend Line',
                data: regressionLine,
                type: 'line',
                borderColor: 'rgb(75, 192, 192)',
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature vs Time'
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const point = context.raw;
                            return `Time: ${point.x.toLocaleString()}\nTemperature: ${point.y.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });
}

// Add event listeners for chat functionality
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
});

// Function to send a message to the weather assistant
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Clear input
    chatInput.value = '';
    
    // Display user message
    appendMessage('user', userMessage);

    try {
        // Get weather context
        const weatherContext = {
            location: currentLocation.name,
            temperature: document.getElementById('temperature').textContent,
            condition: document.getElementById('condition').textContent,
            humidity: document.getElementById('humidity').textContent,
            wind: document.getElementById('wind').textContent
        };

        // Call AI API
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful weather assistant."
                    },
                    {
                        role: "user",
                        content: `Current weather in ${weatherContext.location}:
                            Temperature: ${weatherContext.temperature}
                            Condition: ${weatherContext.condition}
                            Humidity: ${weatherContext.humidity}
                            Wind: ${weatherContext.wind}

                            User question: ${userMessage}`
                    }
                ]
            })
        });

        const data = await response.json();
        appendMessage('assistant', data.choices[0].message.content);

    } catch (error) {
        console.error('Error:', error);
        appendMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    }
}

function appendMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `${role}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update temperature trends chart
function updateTemperatureTrendsChart(temperatures) {
    if (!temperatureTrendsChart || !temperatures || temperatures.length === 0) return;
    
    // Calculate average temperature of all reports
    const avgTemperature = temperatures.reduce((sum, temp) => sum + temp.temperature, 0) / temperatures.length;
    
    // Create a single data point for the average
    const timePointTemps = [avgTemperature];
    const formattedTimes = ['Average'];
    
    // Update chart data
    temperatureTrendsChart.data.labels = formattedTimes;
    temperatureTrendsChart.data.datasets = [{
        label: 'Average Temperature',
        data: timePointTemps,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointStyle: 'circle',
        fill: false
    }];
    
    // Update chart options
    temperatureTrendsChart.options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: 'Temperature (°C)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'User Reports'
                },
                ticks: {
                    maxRotation: 0,
                    minRotation: 0
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(1) + '°C';
                            label += ` (Based on ${temperatures.length} reports)`;
                        }
                        return label;
                    }
                }
            },
            title: {
                display: true,
                text: 'Average User-Reported Temperature',
                font: {
                    size: 16
                }
            }
        }
    };
    
    temperatureTrendsChart.update();
}

// Update historical analysis
async function updateHistoricalAnalysis(lat, lon) {
    try {
        // Simulate 30 days of historical data
        const dates = Array.from({length: 30}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i)); // Count forward from 30 days ago
            return formatDate(date.getTime() / 1000);
        });
        
        // Generate realistic-looking temperature data
        const baseTemp = 20; // Base temperature
        const temps = dates.map(() => baseTemp + (Math.random() * 10 - 5)); // Variation of ±5°C
        
        // Calculate moving average
        const average = temps.map((_, index, array) => {
            const slice = array.slice(0, index + 1);
            return slice.reduce((sum, val) => sum + val, 0) / slice.length;
        });
        
        // Calculate trend using simple linear regression
        const trend = temps.map((_, index) => {
            const x = index;
            const y = temps[index];
            const xMean = (temps.length - 1) / 2;
            const yMean = temps.reduce((a, b) => a + b) / temps.length;
            const slope = temps.reduce((a, b, i) => a + (i - xMean) * (b - yMean), 0) / 
                         temps.reduce((a, _, i) => a + Math.pow(i - xMean, 2), 0);
            return yMean + slope * (x - xMean);
        });

        // Update historical chart
        if (historicalChart) {
            updateChartData(historicalChart, {
                labels: dates,
                datasets: [
                    {
                        label: 'Daily Temperature (°C)',
                        data: temps,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Moving Average',
                        data: average,
                        borderColor: 'rgb(255, 159, 64)',
                        borderDash: [5, 5],
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Temperature Trend',
                        data: trend,
                        borderColor: 'rgb(153, 102, 255)',
                        borderDash: [10, 5],
                        tension: 0.1,
                        fill: false
                    }
                ]
            });
        }
    } catch (error) {
        console.error('Error updating historical analysis:', error);
    }
}