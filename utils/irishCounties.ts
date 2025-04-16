// List of valid Irish counties
export const irishCounties = [
  "Co. Antrim", "Co. Armagh", "Co. Carlow", "Co. Cavan", "Co. Clare", "Co. Cork", "Co. Derry", "Co. Donegal", 
  "Co. Down", "Co. Dublin", "Co. Fermanagh", "Co. Galway", "Co. Kerry", "Co. Kildare", "Co. Kilkenny", 
  "Co. Laois", "Co. Leitrim", "Co. Limerick", "Co. Longford", "Co. Louth", "Co. Mayo", "Co. Meath", 
  "Co. Monaghan", "Co. Offaly", "Co. Roscommon", "Co. Sligo", "Co. Tipperary", "Co. Tyrone", 
  "Co. Waterford", "Co. Westmeath", "Co. Wexford", "Co. Wicklow"
];

/**
 * Validates if a county exists in Ireland
 * @param county The county to validate
 * @returns boolean indicating if the county is valid
 */
export const isValidCounty = (county: string): boolean => {
  if (!county) return false;
  
  // Check if the county already has "Co." prefix
  const countyWithPrefix = county.startsWith("Co. ") ? county : `Co. ${county}`;
  
  return irishCounties.some(
    validCounty => validCounty.toLowerCase() === countyWithPrefix.toLowerCase()
  );
}; 