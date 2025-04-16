import { irishCounties, isValidCounty } from '../../utils/irishCounties';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { county } = body;

    if (!county) {
      return Response.json(
        { error: "County is required" },
        { status: 400 }
      );
    }

    // Check if the county exists in our list
    const countyExists = isValidCounty(county);

    return Response.json(
      { 
        isValid: countyExists,
        counties: irishCounties // Return the full list for dropdown
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error validating county:", error);
    return Response.json(
      { error: "Failed to validate county" },
      { status: 500 }
    );
  }
} 