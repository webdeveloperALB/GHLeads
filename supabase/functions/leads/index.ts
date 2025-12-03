import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const log = (message, data)=>{
  const timestamp = new Date().toISOString();
  const logData = data ? `${message} ${JSON.stringify(data)}` : message;
  console.log(`[${timestamp}] ${logData}`);
};
// Format date into: "01 September 2025"
const humanDate = (value)=>value ? new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value)) : null;
serve(async (req)=>{
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: "missing_api_key",
          message: "API key is required"
        }
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: apiKeyData, error: apiKeyError } = await supabase.from("api_keys").select("*").eq("api_key", apiKey).maybeSingle();
    if (apiKeyError || !apiKeyData || !apiKeyData.is_active) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: "unauthorized",
          message: "Invalid or inactive API key"
        }
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (apiKeyData.allowed_ips?.length > 0) {
      const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");
      if (!clientIp || !apiKeyData.allowed_ips.includes(clientIp)) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "ip_not_allowed",
            message: "IP address not allowed"
          }
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    // ---------- GET LEADS ----------
    if (req.method === "GET") {
      const url = new URL(req.url);
      const email = url.searchParams.get("email");
      const sort = url.searchParams.get("sort");
      const fromDate = url.searchParams.get("from");
      const toDate = url.searchParams.get("to");
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      let query = supabase.from("leads").select("id, first_name, last_name, email, phone, country, status, has_deposited, converted_at, created_at", {
        count: "exact"
      }).eq("api_key_id", apiKeyData.id);
      if (email) query = query.eq("email", email);
      if (fromDate && !isNaN(Date.parse(fromDate))) {
        query = query.gte("created_at", new Date(fromDate).toISOString());
      }
      if (toDate && !isNaN(Date.parse(toDate))) {
        query = query.lte("created_at", new Date(toDate).toISOString());
      }
      if (sort === "asc" || sort === "desc") {
        query = query.order("created_at", {
          ascending: sort === "asc"
        });
      }
      if (limit && offset) {
        const l = parseInt(limit);
        const o = parseInt(offset);
        query = query.range(o, o + l - 1);
      } else if (limit) {
        const l = parseInt(limit);
        query = query.range(0, l - 1);
      }
      log("Fetching leads with filter", {
        fromDate,
        toDate,
        limit,
        offset
      });
      const { data, error } = await query;
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "query_error",
            message: error.message
          }
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Always return human-readable dates
      const formatted = data.map((lead)=>({
          ...lead,
          created_at: humanDate(lead.created_at),
          converted_at: humanDate(lead.converted_at)
        }));
      return new Response(JSON.stringify({
        success: true,
        data: formatted
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ---------- POST LEAD ----------
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.firstName || !body.lastName || !body.email) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "validation_error",
            message: "Missing required fields",
            details: {
              fields: [
                "firstName",
                "lastName",
                "email"
              ]
            }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: "validation_error",
            message: "Invalid email format",
            details: {
              field: "email",
              value: body.email
            }
          }
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const { data: existingLead } = await supabase.from("leads").select("id, email, phone").or(`email.eq.${body.email}${body.phone ? `,phone.eq.${body.phone}` : ""}`).maybeSingle();
      if (existingLead) {
        let message = "Duplicate lead found";
        let code = "duplicate_lead";
        if (existingLead.email === body.email) {
          message = "Lead with this email already exists";
          code = "duplicate_email";
        } else if (existingLead.phone === body.phone) {
          message = "Lead with this phone number already exists";
          code = "duplicate_phone";
        }
        return new Response(JSON.stringify({
          success: false,
          error: {
            code,
            message
          }
        }), {
          status: 409,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      // Check for automatic assignment rules using the API key prefix
      let assignedAgentId = null;
      let assignmentRuleInfo = null;

      if (body.country) {
        // Country name to code mapping
        const countryMap: Record<string, string> = {
          'italy': 'IT',
          'france': 'FR',
          'germany': 'DE',
          'spain': 'ES',
          'portugal': 'PT',
          'greece': 'GR',
          'netherlands': 'NL',
          'belgium': 'BE',
          'austria': 'AT',
          'poland': 'PL',
          'romania': 'RO',
          'czech republic': 'CZ',
          'hungary': 'HU',
          'sweden': 'SE',
          'denmark': 'DK',
          'finland': 'FI',
          'norway': 'NO',
          'switzerland': 'CH',
          'ireland': 'IE',
          'united kingdom': 'GB',
          'uk': 'GB',
          'united states': 'US',
          'usa': 'US',
          'canada': 'CA',
          'australia': 'AU',
          'new zealand': 'NZ'
        };

        // Normalize country: convert to uppercase
        const normalizedInput = body.country.trim().toUpperCase();

        // Check if input is a 2-letter code or needs to be mapped from full name
        let countryCode = normalizedInput;
        if (normalizedInput.length > 2) {
          const mappedCode = countryMap[normalizedInput.toLowerCase()];
          if (mappedCode) {
            countryCode = mappedCode;
          }
        }

        log('Checking assignment rules', {
          source: apiKeyData.source_prefix,
          originalCountry: body.country,
          normalizedCountryCode: countryCode
        });

        const { data: matchingRules, error: ruleError } = await supabase
          .from('lead_assignment_rules')
          .select('*, assigned_agent:user_profiles!lead_assignment_rules_assigned_agent_id_fkey(id, full_name)')
          .eq('source_name', apiKeyData.source_prefix)
          .ilike('country_code', countryCode)
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .limit(1);

        log('Rule query result', {
          matchingRules,
          ruleError,
          count: matchingRules?.length || 0
        });

        if (!ruleError && matchingRules && matchingRules.length > 0) {
          const rule = matchingRules[0];
          assignedAgentId = rule.assigned_agent_id;
          assignmentRuleInfo = {
            source: rule.source_name,
            country: rule.country_code,
            agentName: rule.assigned_agent?.full_name || 'Unknown Agent'
          };
          log('Assigning to agent', assignedAgentId);
        } else {
          log('No matching rules found', null);
        }
      }

      // Optional convertedAt support
      const convertedAtIso = body.convertedAt && !isNaN(Date.parse(body.convertedAt)) ? new Date(body.convertedAt).toISOString() : null;
      const { data: lead, error: leadError } = await supabase.from("leads").insert([
        {
          first_name: body.firstName,
          last_name: body.lastName,
          email: body.email,
          phone: body.phone || null,
          country: body.country || null,
          brand: body.brand || null,
          source: apiKeyData.source_prefix,
          funnel: body.funnel || null,
          desk: body.desk || null,
          status: "New",
          source_id: body.source_id || apiKeyData.source_id || null,
          api_key_id: apiKeyData.id,
          converted_at: convertedAtIso,
          assigned_to: assignedAgentId
        }
      ]).select().single();
      if (leadError || !lead) throw leadError || new Error("Lead was not created");

      // Log automatic assignment activity if a rule was applied
      if (assignmentRuleInfo) {
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          type: 'auto_assignment',
          description: `Automatically assigned to ${assignmentRuleInfo.agentName} based on source '${assignmentRuleInfo.source}' and country '${assignmentRuleInfo.country}'`
        });
      }

      await supabase.from("lead_activities").insert([
        {
          lead_id: lead.id,
          type: convertedAtIso ? "conversion" : "creation",
          description: convertedAtIso ? `Lead created with FTD at ${convertedAtIso} via API (${apiKeyData.source_prefix})` : `Lead created via API (${apiKeyData.source_prefix})`
        }
      ]);
      await supabase.from("api_keys").update({
        last_used: new Date().toISOString()
      }).eq("id", apiKeyData.id);
      // Return human-readable dates in POST response as well
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: lead.id,
          source_id: lead.source_id,
          created_at: humanDate(lead.created_at),
          converted_at: humanDate(lead.converted_at)
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: "method_not_allowed",
        message: "Method not allowed"
      }
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    log("❌ Unhandled error", error);
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: "internal_error",
        message: error?.message || "Internal server error"
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
