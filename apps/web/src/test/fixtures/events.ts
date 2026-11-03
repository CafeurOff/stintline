// Recorded from the demo API (Hungarian Grand Prix 2025, session 70), trimmed.
import type { Schema } from "@stintline/api-types";

export const events = {
  count: 4,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      season: 2025,
      round: 1,
      name: "Australian Grand Prix",
      race_date: "2025-03-16",
      format: "conventional",
      circuit: {
        ref: "albert_park",
        name: "Albert Park Grand Prix Circuit",
        locality: "Melbourne",
        country: "Australia",
      },
      sessions: [
        {
          id: 1,
          kind: "FP1",
          scheduled_start: "2025-03-14T01:30:00Z",
          has_data: false,
        },
        {
          id: 2,
          kind: "FP2",
          scheduled_start: "2025-03-14T05:00:00Z",
          has_data: false,
        },
        {
          id: 3,
          kind: "FP3",
          scheduled_start: "2025-03-15T01:30:00Z",
          has_data: false,
        },
        {
          id: 4,
          kind: "Q",
          scheduled_start: "2025-03-15T05:00:00Z",
          has_data: false,
        },
        {
          id: 5,
          kind: "R",
          scheduled_start: "2025-03-16T04:00:00Z",
          has_data: false,
        },
      ],
    },
    {
      id: 4,
      season: 2025,
      round: 4,
      name: "Bahrain Grand Prix",
      race_date: "2025-04-13",
      format: "conventional",
      circuit: {
        ref: "bahrain",
        name: "Bahrain International Circuit",
        locality: "Sakhir",
        country: "Bahrain",
      },
      sessions: [
        {
          id: 16,
          kind: "FP1",
          scheduled_start: "2025-04-11T11:30:00Z",
          has_data: false,
        },
        {
          id: 17,
          kind: "FP2",
          scheduled_start: "2025-04-11T15:00:00Z",
          has_data: false,
        },
        {
          id: 18,
          kind: "FP3",
          scheduled_start: "2025-04-12T12:30:00Z",
          has_data: false,
        },
        {
          id: 19,
          kind: "Q",
          scheduled_start: "2025-04-12T16:00:00Z",
          has_data: false,
        },
        {
          id: 20,
          kind: "R",
          scheduled_start: "2025-04-13T15:00:00Z",
          has_data: true,
        },
      ],
    },
    {
      id: 14,
      season: 2025,
      round: 14,
      name: "Hungarian Grand Prix",
      race_date: "2025-08-03",
      format: "conventional",
      circuit: {
        ref: "hungaroring",
        name: "Hungaroring",
        locality: "Budapest",
        country: "Hungary",
      },
      sessions: [
        {
          id: 66,
          kind: "FP1",
          scheduled_start: "2025-08-01T11:30:00Z",
          has_data: false,
        },
        {
          id: 67,
          kind: "FP2",
          scheduled_start: "2025-08-01T15:00:00Z",
          has_data: false,
        },
        {
          id: 68,
          kind: "FP3",
          scheduled_start: "2025-08-02T10:30:00Z",
          has_data: false,
        },
        {
          id: 69,
          kind: "Q",
          scheduled_start: "2025-08-02T14:00:00Z",
          has_data: false,
        },
        {
          id: 70,
          kind: "R",
          scheduled_start: "2025-08-03T13:00:00Z",
          has_data: true,
        },
      ],
    },
    {
      id: 16,
      season: 2025,
      round: 16,
      name: "Italian Grand Prix",
      race_date: "2025-09-07",
      format: "conventional",
      circuit: {
        ref: "monza",
        name: "Autodromo Nazionale di Monza",
        locality: "Monza",
        country: "Italy",
      },
      sessions: [
        {
          id: 76,
          kind: "FP1",
          scheduled_start: "2025-09-05T11:30:00Z",
          has_data: false,
        },
        {
          id: 77,
          kind: "FP2",
          scheduled_start: "2025-09-05T15:00:00Z",
          has_data: false,
        },
        {
          id: 78,
          kind: "FP3",
          scheduled_start: "2025-09-06T10:30:00Z",
          has_data: false,
        },
        {
          id: 79,
          kind: "Q",
          scheduled_start: "2025-09-06T14:00:00Z",
          has_data: false,
        },
        {
          id: 80,
          kind: "R",
          scheduled_start: "2025-09-07T13:00:00Z",
          has_data: true,
        },
      ],
    },
  ],
} satisfies Schema<"PaginatedEventList">;
