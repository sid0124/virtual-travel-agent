import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("q");

    if (!text) {
      return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
    }

    // Ensure we don't call Geocoding with empty string
    if (text.trim() === "") {
        return NextResponse.json({ error: "Empty query" }, { status: 400 });
    }

    // Try Geoapify Geocoding API if key is present
    const geoapifyKey = process.env.GEOAPIFY_API_KEY;
    if (geoapifyKey) {
      const geoapifyUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&limit=1&apiKey=${geoapifyKey}`;
      const res = await fetch(geoapifyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          return NextResponse.json({
            lat: props.lat,
            lng: props.lon,
            source: "geoapify"
          });
        }
      }
    }

    // Fallback to nominatim (OpenStreetMap), free to use
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "WanderlyTravelApp/1.0",
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return NextResponse.json({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          source: "nominatim"
        });
      }
    }

    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
