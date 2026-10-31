// Weather Forecast App — uses the free Open-Meteo API (no API key needed)

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// DOM elements
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const locationBtn = document.getElementById("location-btn");
const unitC = document.getElementById("unit-c");
const unitF = document.getElementById("unit-f");
const messageEl = document.getElementById("message");
const currentEl = document.getElementById("current");
const forecastSection = document.getElementById("forecast-section");
const forecastEl = document.getElementById("forecast");

// App state
let unit = "celsius"; // "celsius" or "fahrenheit"
let place = null;     // { name, latitude, longitude }

// Weather codes (WMO) -> emoji + description
const WEATHER_CODES = {
  0: ["☀️", "Clear sky"],
  1: ["🌤️", "Mainly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌦️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Freezing drizzle"],
  61: ["🌧️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["❄️", "Snow grains"],
  80: ["🌦️", "Rain showers"],
  81: ["🌧️", "Rain showers"],
  82: ["⛈️", "Violent rain showers"],
  85: ["🌨️", "Snow showers"],
  86: ["❄️", "Heavy snow showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm with hail"],
  99: ["⛈️", "Thunderstorm with hail"]
};

function describe(code) {
  return WEATHER_CODES[code] || ["🌡️", "Unknown"];
}

// ---------- UI helpers ----------

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = "message" + (isError ? " error" : "");
  messageEl.hidden = false;
}

function hideMessage() {
  messageEl.hidden = true;
}

function hideResults() {
  currentEl.hidden = true;
  forecastSection.hidden = true;
}

function unitSymbol() {
  return unit === "celsius" ? "°C" : "°F";
}

function windUnit() {
  return unit === "celsius" ? "km/h" : "mph";
}

// ---------- API calls ----------

async function findCity(name) {
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not search for that city.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No city found for "${name}".`);
  }
  const r = data.results[0];
  const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  return { name: label, latitude: r.latitude, longitude: r.longitude };
}

async function fetchWeather(p) {
  const params = new URLSearchParams({
    latitude: p.latitude,
    longitude: p.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: 7,
    temperature_unit: unit,
    wind_speed_unit: unit === "celsius" ? "kmh" : "mph"
  });
  const res = await fetch(`${WEATHER_URL}?${params}`);
  if (!res.ok) throw new Error("Could not load weather data.");
  return res.json();
}

// ---------- Rendering ----------

function renderCurrent(p, data) {
  const c = data.current;
  const [emoji, text] = describe(c.weather_code);

  document.getElementById("city-name").textContent = p.name;
  document.getElementById("date-text").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
  document.getElementById("current-icon").textContent = emoji;
  document.getElementById("current-temp").textContent = `${Math.round(c.temperature_2m)}${unitSymbol()}`;
  document.getElementById("current-desc").textContent = text;
  document.getElementById("feels-like").textContent = `${Math.round(c.apparent_temperature)}${unitSymbol()}`;
  document.getElementById("humidity").textContent = `${c.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${Math.round(c.wind_speed_10m)} ${windUnit()}`;

  currentEl.hidden = false;
}

function renderForecast(data) {
  const d = data.daily;
  forecastEl.innerHTML = "";

  d.time.forEach((dateStr, i) => {
    // Add T00:00 so the date is parsed as local time, not UTC
    const date = new Date(dateStr + "T00:00:00");
    const dayName = i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" });
    const [emoji] = describe(d.weather_code[i]);

    const card = document.createElement("div");
    card.className = "day";
    card.innerHTML = `
      <div class="name">${dayName}</div>
      <div class="emoji">${emoji}</div>
      <div class="range">${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</div>
      <div class="rain">💧 ${d.precipitation_probability_max[i] ?? 0}%</div>
    `;
    forecastEl.appendChild(card);
  });

  forecastSection.hidden = false;
}

// ---------- Main flow ----------

async function loadWeather(p) {
  showMessage("Loading weather...");
  hideResults();
  try {
    const data = await fetchWeather(p);
    place = p;
    localStorage.setItem("lastPlace", JSON.stringify(p));
    renderCurrent(p, data);
    renderForecast(data);
    hideMessage();
  } catch (err) {
    showMessage(err.message || "Something went wrong.", true);
  }
}

async function searchCity(name) {
  showMessage("Searching...");
  hideResults();
  try {
    const p = await findCity(name);
    await loadWeather(p);
  } catch (err) {
    showMessage(err.message || "Something went wrong.", true);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    showMessage("Geolocation is not supported by your browser.", true);
    return;
  }
  showMessage("Getting your location...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loadWeather({
        name: "Your location",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    },
    () => showMessage("Location access was denied. Try searching for a city instead.", true)
  );
}

function setUnit(newUnit) {
  if (newUnit === unit) return;
  unit = newUnit;
  unitC.classList.toggle("active", unit === "celsius");
  unitF.classList.toggle("active", unit === "fahrenheit");
  localStorage.setItem("unit", unit);
  if (place) loadWeather(place);
}

// ---------- Events ----------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cityInput.value.trim();
  if (name) searchCity(name);
});

locationBtn.addEventListener("click", useMyLocation);
unitC.addEventListener("click", () => setUnit("celsius"));
unitF.addEventListener("click", () => setUnit("fahrenheit"));

// ---------- Startup ----------

(function init() {
  const savedUnit = localStorage.getItem("unit");
  if (savedUnit === "fahrenheit") {
    unit = "fahrenheit";
    unitC.classList.remove("active");
    unitF.classList.add("active");
  }

  const saved = localStorage.getItem("lastPlace");
  if (saved) {
    try {
      loadWeather(JSON.parse(saved));
      return;
    } catch (e) { /* fall through to default */ }
  }
  searchCity("Delhi");
})();
