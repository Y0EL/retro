import OpenAI from "openai"

export const RETRO_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "crawl_website",
      description: "Crawl a company website and extract text content. Use when you need to learn about a company from their website.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to crawl including https://" },
          extract_emails: { type: "boolean", description: "Whether to also extract email addresses" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the internet (DuckDuckGo) for any information — company profiles, websites, events, products, contacts. Use this to find real URLs before crawling.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query in any language" },
          max_results: { type: "number", description: "Number of results (default 10)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_news",
      description: "Search for recent news and events about a topic, company, or industry.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          language: { type: "string", enum: ["id", "en", "auto"] }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "profile_company",
      description: "Use LLM to create a structured profile card from raw company text. Returns industry, products, collaboration potential.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          text: { type: "string", description: "Raw text content from company website" },
          language: { type: "string" }
        },
        required: ["company_name", "text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "domain_intelligence",
      description: "Get OSINT data about a domain: WHOIS, technology stack, historical snapshots.",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string" }
        },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "discover_emails",
      description: "Find email addresses for a company using web scraping.",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string" },
          company_name: { type: "string" }
        },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_entities",
      description: "Extract named entities (organizations, persons, locations, emails, phones) from text using NLP.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          language: { type: "string" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_proposal",
      description: "Generate a formal B2B partnership proposal letter for a specific company.",
      parameters: {
        type: "object",
        properties: {
          company_profile: { type: "object", description: "Company profile card from profile_company tool" },
          author: { type: "string", description: "Name of the sender/author" },
          context: { type: "string", description: "Additional context about the partnership goal" }
        },
        required: ["company_profile", "author"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "render_pdf",
      description: "Render a PDF document from structured data.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["outbound", "internal"] },
          data: { type: "object" },
          theme: { type: "string", enum: ["light", "dark"] }
        },
        required: ["type", "data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_to_knowledge_base",
      description: "Save company profile, correspondence, or research result to the persistent knowledge base.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["company_profile", "correspondence", "research", "proposal"] },
          data: { type: "object" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["type", "data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_briefing_report",
      description: "Generate a comprehensive pre-meeting briefing report for a specific company.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          domain: { type: "string" },
          context: { type: "string", description: "What is the meeting about, what are we interested in" }
        },
        required: ["company_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ip_intelligence",
      description: "Get geolocation, ASN, and organization info for an IP address (ipinfo.io).",
      parameters: {
        type: "object",
        properties: {
          ip: { type: "string", description: "IP address to look up" }
        },
        required: ["ip"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "url_scan",
      description: "Scan a URL for malware/phishing verdict and screenshot using URLScan.io.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL to scan including https://" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "domain_reputation",
      description: "Check a domain's malware/phishing history and reputation score via VirusTotal.",
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Domain name without protocol (e.g. example.com)" }
        },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sanctions_check",
      description: "Check if a company or person name appears in global sanctions lists (OpenSanctions).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company or person name to check" },
          type: { type: "string", enum: ["company", "person"], description: "Entity type" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "company_lookup",
      description: "Look up official company registration data from OpenCorporates global database.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name to look up" },
          jurisdiction: { type: "string", description: "Jurisdiction code (e.g. id for Indonesia, us for USA)" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "threat_intel",
      description: "Get threat intelligence pulses and malware associations for a domain or IP (AlienVault OTX).",
      parameters: {
        type: "object",
        properties: {
          indicator: { type: "string", description: "Domain, IP, or URL to analyze" },
          type: { type: "string", enum: ["domain", "ip", "url"], description: "Indicator type" }
        },
        required: ["indicator"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "wayback_snapshot",
      description: "Get historical snapshots of a website from the Wayback Machine (Internet Archive).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to look up in Wayback Machine" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "geolocation",
      description: "Geocode an address or company location using OpenStreetMap/Nominatim.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Address or location query to geocode" }
        },
        required: ["query"]
      }
    }
  }
]
