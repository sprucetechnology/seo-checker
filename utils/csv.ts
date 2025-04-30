// CSV utility functions

export function jsonToCsv(data: any[]): string {
  if (data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        
        // Handle arrays or objects
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        
        // Escape quotes and handle strings with commas
        if (typeof value === "string" && (value.includes('"') || value.includes(','))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(",")
    )
  ].join("\n");
  
  return csv;
} 