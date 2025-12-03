import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { user_id, user_agent } = await req.json()

    // Get client IP from request headers
    const forwardedFor = req.headers.get('x-forwarded-for')
    // Extract first IP if multiple IPs are present (comma-separated)
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 
                     req.headers.get('x-real-ip') || 
                     'unknown'

    // Fetch geolocation data
    let city = null
    let country = null

    if (clientIP && clientIP !== 'unknown' && clientIP !== '127.0.0.1' && clientIP !== 'localhost') {
      try {
        console.log(`Fetching geolocation for IP: ${clientIP}`)
        const geoResponse = await fetch(`http://ip-api.com/json/${clientIP}`)
        if (geoResponse.ok) {
          const geoData = await geoResponse.json()
          console.log('Geolocation data:', geoData)
          city = geoData.city
          country = geoData.country
        } else {
          console.error('Geolocation API error:', geoResponse.status, geoResponse.statusText)
        }
      } catch (geoError) {
        console.error('Error fetching geolocation:', geoError)
      }
    }

    console.log(`Logging: IP=${clientIP}, City=${city}, Country=${country}`)

    // Insert login log
    const { error } = await supabase
      .from('login_logs')
      .insert({
        user_id,
        ip_address: clientIP,
        user_agent: JSON.stringify(user_agent),
        city,
        country
      })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})