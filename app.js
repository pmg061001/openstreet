const MIN_SEARCH_INTERVAL_MS = 1100;
const SEARCH_DEBOUNCE_MS = 1000;

const fields = ["origin", "destination"].map((id) => ({
  input: document.getElementById(id),
  results: document.getElementById(`${id}-results`),
  status: document.getElementById(`${id}-status`),
  selected: null,
  timer: null,
  controller: null,
  requestId: 0,
}));

const form = document.getElementById("route-form");
const formMessage = document.getElementById("form-message");
const calculateButton = document.getElementById("calculate-button");
const resultPanel = document.getElementById("result");
const distanceOutput = document.getElementById("distance");
const mapLink = document.getElementById("map-link");
let nextSearchAllowedAt = 0;

function closeSuggestions(field) {
  field.results.hidden = true;
  field.input.setAttribute("aria-expanded", "false");
}

function setFieldStatus(field, message) {
  field.status.textContent = message;
}

function setFormMessage(message) {
  formMessage.textContent = message;
}

function renderSuggestions(field, places) {
  field.results.replaceChildren();

  for (const place of places) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "suggestion";
    button.type = "button";
    button.setAttribute("role", "option");
    button.textContent = place.display_name;
    button.addEventListener("click", () => {
      field.selected = place;
      field.input.value = place.display_name;
      setFieldStatus(field, "선택됨");
      closeSuggestions(field);
      setFormMessage("");
      resultPanel.hidden = true;
    });
    item.append(button);
    field.results.append(item);
  }

  field.results.hidden = places.length === 0;
  field.input.setAttribute("aria-expanded", String(places.length > 0));
}

async function searchPlaces(field, query, requestId) {
  const startAt = Math.max(Date.now(), nextSearchAllowedAt);
  nextSearchAllowedAt = startAt + MIN_SEARCH_INTERVAL_MS;
  const wait = startAt - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, wait));
  }

  if (requestId !== field.requestId || query !== field.input.value.trim()) return;

  field.controller = new AbortController();
  setFieldStatus(field, "검색 중");

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    "accept-language": "ko,en",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: field.controller.signal,
    });
    if (!response.ok) throw new Error("장소 검색에 실패했습니다.");
    const places = await response.json();

    if (requestId !== field.requestId) return;
    if (!Array.isArray(places)) throw new Error("검색 결과를 읽을 수 없습니다.");
    renderSuggestions(field, places);
    setFieldStatus(field, places.length ? "장소 선택" : "결과 없음");
  } catch (error) {
    if (error.name === "AbortError" || requestId !== field.requestId) return;
    closeSuggestions(field);
    setFieldStatus(field, "");
    setFormMessage("장소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}

for (const field of fields) {
  field.input.addEventListener("input", () => {
    window.clearTimeout(field.timer);
    field.requestId += 1;
    field.controller?.abort();
    field.controller = null;
    field.selected = null;
    closeSuggestions(field);
    resultPanel.hidden = true;
    setFormMessage("");

    const query = field.input.value.trim();
    if (query.length < 2) {
      setFieldStatus(field, "");
      return;
    }

    const requestId = field.requestId;
    field.timer = window.setTimeout(() => {
      void searchPlaces(field, query, requestId);
    }, SEARCH_DEBOUNCE_MS);
  });

  field.input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSuggestions(field);
  });

  field.input.addEventListener("blur", () => {
    window.setTimeout(() => closeSuggestions(field), 150);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const [origin, destination] = fields;

  if (!origin.selected || !destination.selected) {
    setFormMessage("검색 결과에서 출발지와 도착지를 각각 선택해 주세요.");
    (!origin.selected ? origin : destination).input.focus();
    return;
  }

  if (origin.selected.place_id === destination.selected.place_id) {
    setFormMessage("출발지와 도착지를 서로 다른 장소로 선택해 주세요.");
    return;
  }

  setFormMessage("");
  resultPanel.hidden = true;
  calculateButton.disabled = true;
  calculateButton.querySelector("span").textContent = "경로 계산 중...";

  const start = origin.selected;
  const end = destination.selected;
  const coordinates = `${start.lon},${start.lat};${end.lon},${end.lat}`;

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("경로 검색에 실패했습니다.");

    const data = await response.json();
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route || !Number.isFinite(route.distance)) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했습니다.");
    }

    distanceOutput.textContent = formatDistance(route.distance);
    const mapParams = new URLSearchParams({
      engine: "fossgis_osrm_car",
      route: `${start.lat},${start.lon};${end.lat},${end.lon}`,
    });
    mapLink.href = `https://www.openstreetmap.org/directions?${mapParams}`;
    resultPanel.hidden = false;
  } catch (error) {
    setFormMessage(`${error.message} 잠시 후 다시 시도해 주세요.`);
  } finally {
    calculateButton.disabled = false;
    calculateButton.querySelector("span").textContent = "거리 계산하기";
  }
});

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString("ko-KR")} m`;
  }

  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 1 : 0;
  return `${kilometers.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`;
}
