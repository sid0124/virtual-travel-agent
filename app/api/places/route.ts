import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "lat and lon are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Geoapify API key not configured" },
        { status: 500 }
      );
    }

    const url =
      `https://api.geoapify.com/v2/places` +
      `?categories=tourism.sights,tourism.attraction` +
      `&filter=circle:${lon},${lat},15000` +
      `&limit=15` +
      `&apiKey=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Geoapify API failed");
    }

    const data = await res.json();

    const places = (data.features || []).map((item: any) => ({
      id: item.properties.place_id,
      name: item.properties.name,
      category: item.properties.categories,
      address: item.properties.formatted,
      distance: item.properties.distance,
    }));

    return NextResponse.json({ places });
  } catch (error) {
    console.error("Geoapify error:", error);
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}
