/**
 * Google Workspace API integrations
 */

export async function searchDriveFiles(token: string, term: string = "") {
  let query = "mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf' or name contains 'resume' or name contains 'cv'";
  if (term) {
    query = `(${query}) and name contains '${term.replace(/'/g, "\\'")}'`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)&pageSize=30`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Drive fetch failed: ${errorText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function getFileContent(token: string, fileId: string, mimeType: string): Promise<string> {
  if (mimeType === "application/vnd.google-apps.document") {
    // Export Google Docs to text/plain
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to export Google Doc: ${await res.text()}`);
    }
    return await res.text();
  } else {
    // Download standard body
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to download file media: ${await res.text()}`);
    }
    return await res.text();
  }
}

export interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
}

export async function listCalendarEvents(token: string, timeMin: string, timeMax: string) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed: ${await res.text()}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function createCalendarEvent(token: string, event: CalendarEvent) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error(`Calendar event creation failed: ${await res.text()}`);
  }
  return await res.json();
}

export async function sendGmail(token: string, to: string, subject: string, bodyHtml: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
  
  // Basic MIME assembly
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Mime-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    bodyHtml
  ];
  
  const emailStr = emailLines.join("\r\n");
  const base64Safe = btoa(unescape(encodeURIComponent(emailStr)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Safe }),
  });
  
  if (!res.ok) {
    throw new Error(`Gmail sending failed: ${await res.text()}`);
  }
  return await res.json();
}

export async function createGoogleContact(token: string, name: string, email: string, phone: string, score: number, role: string) {
  const url = "https://people.googleapis.com/v1/people:createContact";
  const contactPayload = {
    names: [{ givenName: name }],
    emailAddresses: email ? [{ value: email, type: "work" }] : [],
    phoneNumbers: phone ? [{ value: phone, type: "mobile" }] : [],
    biographies: [{ value: `Candidate scored ${score}% for the role of '${role}'. Evaluated by Applicant Screening Portal.` }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(contactPayload),
  });

  if (!res.ok) {
    throw new Error(`Google Contact creation failed: ${await res.text()}`);
  }
  return await res.json();
}
