import os
import oracledb
import random
import re
import json
import datetime
import math
from faker import Factory
fake = Factory.create('en_AU')
from geopy.geocoders import Nominatim
geolocator = Nominatim(user_agent="uniTest")
from geopy.extra.rate_limiter import RateLimiter
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)
from global_land_mask import globe
# === WA-SPECIFIC CRIME CATEGORIES WITH MARCH 2025 INCIDENT WEIGHTS ===
WACrimes = [
    {"Category": "Stealing",                  "WA": 654},
    {"Category": "Family Violence",           "WA": 245},
    {"Category": "Drug Offences",             "WA": 165},
    {"Category": "Assault",                   "WA": 84},
    {"Category": "Burglary",                  "WA": 70},
    {"Category": "Sexual Assault",            "WA": 62},
    {"Category": "Weapons Offences",          "WA": 41},
    {"Category": "Stealing of Motor Vehicle", "WA": 30},
    {"Category": "Robbery",                   "WA": 10},
    {"Category": "Homicide",                  "WA": 1},
    {"Category": "Weapons Explosives",        "WA": 1}
]
# === CONFIGURATION ===
use_gaussian_jitter = True
hotspot_probability = 0.15
use_time_clustering = True
crime_specific_time_bias = True
night_hotspot_probability = 0.20
# === FULL SUBURBS LIST ===
Suburbs = [
    {"Suburb": "Mirrabooka",    "Postcode": "6061", "Latitude": -31.8605, "Longitude": 115.8625, "Population": 8500,  "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Balga",         "Postcode": "6061", "Latitude": -31.8548, "Longitude": 115.8378, "Population": 13000, "jitter": 0.025, "Police_District": "Mirrabooka"},
    {"Suburb": "Nollamara",     "Postcode": "6061", "Latitude": -31.8803, "Longitude": 115.8472, "Population": 12000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Westminster",   "Postcode": "6061", "Latitude": -31.8674, "Longitude": 115.8390, "Population": 6500,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Balcatta",      "Postcode": "6021", "Latitude": -31.8750, "Longitude": 115.8130, "Population": 10500, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Hamersley",     "Postcode": "6022", "Latitude": -31.8490, "Longitude": 115.8150, "Population": 5200,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Morley",        "Postcode": "6062", "Latitude": -31.8970, "Longitude": 115.9070, "Population": 22000, "jitter": 0.022, "Police_District": "Mirrabooka"},
    {"Suburb": "Dianella",      "Postcode": "6059", "Latitude": -31.8900, "Longitude": 115.8720, "Population": 24000, "jitter": 0.022, "Police_District": "Mirrabooka"},
    {"Suburb": "Noranda",       "Postcode": "6062", "Latitude": -31.8750, "Longitude": 115.9000, "Population": 8500,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Yokine",        "Postcode": "6060", "Latitude": -31.9100, "Longitude": 115.8550, "Population": 12000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Coolbinia",     "Postcode": "6050", "Latitude": -31.9180, "Longitude": 115.8500, "Population": 1800,  "jitter": 0.012, "Police_District": "Mirrabooka"},
    {"Suburb": "Menora",        "Postcode": "6050", "Latitude": -31.9200, "Longitude": 115.8620, "Population": 3000,  "jitter": 0.012, "Police_District": "Mirrabooka"},
    {"Suburb": "Joondanna",     "Postcode": "6060", "Latitude": -31.9100, "Longitude": 115.8400, "Population": 5500,  "jitter": 0.015, "Police_District": "Mirrabooka"},
    {"Suburb": "Tuart Hill",    "Postcode": "6060", "Latitude": -31.9000, "Longitude": 115.8350, "Population": 7500,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Bayswater",     "Postcode": "6053", "Latitude": -31.9200, "Longitude": 115.9150, "Population": 15000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Bedford",       "Postcode": "6052", "Latitude": -31.9100, "Longitude": 115.8900, "Population": 5500,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Embleton",      "Postcode": "6062", "Latitude": -31.9030, "Longitude": 115.9100, "Population": 3500,  "jitter": 0.015, "Police_District": "Mirrabooka"},
    {"Suburb": "Inglewood",     "Postcode": "6052", "Latitude": -31.9200, "Longitude": 115.8800, "Population": 6000,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Maylands",      "Postcode": "6051", "Latitude": -31.9330, "Longitude": 115.8920, "Population": 13000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Mount Lawley",  "Postcode": "6050", "Latitude": -31.9340, "Longitude": 115.8720, "Population": 11000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Scarborough",   "Postcode": "6019", "Latitude": -31.8950, "Longitude": 115.7580, "Population": 17000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Stirling",      "Postcode": "6021", "Latitude": -31.8800, "Longitude": 115.8100, "Population": 10000, "jitter": 0.020, "Police_District": "Mirrabooka"},
    {"Suburb": "Innaloo",       "Postcode": "6018", "Latitude": -31.8900, "Longitude": 115.7950, "Population": 9000,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Doubleview",    "Postcode": "6018", "Latitude": -31.8950, "Longitude": 115.7800, "Population": 9000,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Karrinyup",     "Postcode": "6018", "Latitude": -31.8750, "Longitude": 115.7800, "Population": 9500,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "Osborne Park",  "Postcode": "6017", "Latitude": -31.9050, "Longitude": 115.8100, "Population": 4500,  "jitter": 0.015, "Police_District": "Mirrabooka"},
    {"Suburb": "Wembley Downs", "Postcode": "6019", "Latitude": -31.9120, "Longitude": 115.7750, "Population": 6500,  "jitter": 0.015, "Police_District": "Mirrabooka"},
    {"Suburb": "Carine",        "Postcode": "6020", "Latitude": -31.8550, "Longitude": 115.7800, "Population": 7000,  "jitter": 0.018, "Police_District": "Mirrabooka"},
    {"Suburb": "North Beach",   "Postcode": "6020", "Latitude": -31.8600, "Longitude": 115.7550, "Population": 3500,  "jitter": 0.015, "Police_District": "Mirrabooka"},
    {"Suburb": "Trigg",         "Postcode": "6029", "Latitude": -31.8700, "Longitude": 115.7550, "Population": 3000,  "jitter": 0.012, "Police_District": "Mirrabooka"},
    {"Suburb": "Perth",         "Postcode": "6000", "Latitude": -31.9530, "Longitude": 115.8600, "Population": 13000, "jitter": 0.012, "Police_District": "Perth"},
    {"Suburb": "Northbridge",   "Postcode": "6003", "Latitude": -31.9470, "Longitude": 115.8560, "Population": 5500,  "jitter": 0.010, "Police_District": "Perth"},
    {"Suburb": "East Perth",    "Postcode": "6004", "Latitude": -31.9580, "Longitude": 115.8780, "Population": 11000, "jitter": 0.012, "Police_District": "Perth"},
    {"Suburb": "West Perth",    "Postcode": "6005", "Latitude": -31.9480, "Longitude": 115.8430, "Population": 6500,  "jitter": 0.010, "Police_District": "Perth"},
    {"Suburb": "Cannington",    "Postcode": "6107", "Latitude": -32.0160, "Longitude": 115.9340, "Population": 6500,  "jitter": 0.020, "Police_District": "Cannington"},
    {"Suburb": "Bentley",       "Postcode": "6102", "Latitude": -32.0070, "Longitude": 115.9220, "Population": 9500,  "jitter": 0.020, "Police_District": "Cannington"},
    {"Suburb": "Willetton",     "Postcode": "6155", "Latitude": -32.0520, "Longitude": 115.8880, "Population": 19000, "jitter": 0.025, "Police_District": "Cannington"},
    {"Suburb": "Joondalup",     "Postcode": "6027", "Latitude": -31.7450, "Longitude": 115.7660, "Population": 9500,  "jitter": 0.025, "Police_District": "Joondalup"},
    {"Suburb": "Hillarys",      "Postcode": "6025", "Latitude": -31.8070, "Longitude": 115.7400, "Population": 11500, "jitter": 0.025, "Police_District": "Joondalup"},
    {"Suburb": "Currambine",    "Postcode": "6028", "Latitude": -31.7330, "Longitude": 115.7480, "Population": 7500,  "jitter": 0.020, "Police_District": "Joondalup"},
    {"Suburb": "Midland",       "Postcode": "6056", "Latitude": -31.8900, "Longitude": 116.0100, "Population": 6500,  "jitter": 0.020, "Police_District": "Midland"},
    {"Suburb": "Swan View",     "Postcode": "6056", "Latitude": -31.8830, "Longitude": 116.0520, "Population": 8500,  "jitter": 0.022, "Police_District": "Midland"},
    {"Suburb": "Bassendean",    "Postcode": "6054", "Latitude": -31.9050, "Longitude": 115.9500, "Population": 10500, "jitter": 0.020, "Police_District": "Midland"},
    {"Suburb": "Fremantle",     "Postcode": "6160", "Latitude": -32.0560, "Longitude": 115.7450, "Population": 9500,  "jitter": 0.018, "Police_District": "Fremantle"},
    {"Suburb": "South Fremantle","Postcode": "6162", "Latitude": -32.0720, "Longitude": 115.7540, "Population": 3500,  "jitter": 0.012, "Police_District": "Fremantle"},
    {"Suburb": "Beaconsfield",  "Postcode": "6162", "Latitude": -32.0680, "Longitude": 115.7660, "Population": 5500,  "jitter": 0.012, "Police_District": "Fremantle"},
]
state_short = 'WA'
state_long = 'Western Australia'
# === WEIGHTING ===
listSuburbWeights = [d['Population'] for d in Suburbs]
listCrimeWeights = [d['WA'] for d in WACrimes]
# === OCI Generative AI setup ===
import oci
from oci.generative_ai_inference.models import OnDemandServingMode, ChatDetails, GenericChatRequest, UserMessage, TextContent
compartment_id = "ocid1.compartment.oc1..aaaaaaaamxhdernag5emoks3uafxfnfhjmsrfciykvkbq4rrsos5ij2g4t4q"
config = oci.config.from_file('~/.oci/config', "DEFAULT")
endpoint = "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com"
generative_ai_inference_client = oci.generative_ai_inference.GenerativeAiInferenceClient(
    config=config, service_endpoint=endpoint, retry_strategy=oci.retry.NoneRetryStrategy(), timeout=(10, 240))
# === CRIME COLOURS ===
crime_colour = {
    'Burglary': '#1f77b4',
    'Stealing of Motor Vehicle': '#aec7e8',
    'Robbery': '#ff7f0e',
    'Assault': '#ffbb78',
    'Stealing': '#2ca02c',
    'Drug Offences': '#98df8a',
    'Weapons Offences': '#d62728',
    'Homicide': '#ff9896',
    'Sexual Assault': '#9467bd',
    'Family Violence': '#c5b0d5',
    'Weapons Explosives': '#8c564b'
}
# === INSERT SQL ===
crime_insert_sql = """insert into crime_incidents_in (
    report_date, incident_date, incident_suburb, incident_address, incident_postcode,
    incident_state, crime_category, category_colour, crime_detail, case_description,
    latitude, longitude, victim_name, victim_age, victim_gender,
    suspect_name, suspect_age, suspect_gender, suspect_photo, suspect_distinguishing_features,
    officer_name, officer_badge_number, charges, disposition, evidence,
    police_district, origin_app, origin_date, created, ir_number, ir_code
) values (
    :report_date, :incident_date, :incident_suburb, :incident_address, :incident_postcode,
    :incident_state, :crime_category, :category_colour, :crime_detail, :case_description,
    :latitude, :longitude, :victim_name, :victim_age, :victim_gender,
    :suspect_name, :suspect_age, :suspect_gender, :suspect_photo, :suspect_distinguishing_features,
    :officer_name, :officer_badge_number, :charges, :disposition, :evidence,
    :police_district, :origin_app, :origin_date, :created, :ir_number, :ir_code
)"""
# === HELPER FUNCTIONS ===
def extract_between_string_methods(text, start_prefix, end_suffix):
    start_index = text.find(start_prefix)
    if start_index == -1: return None
    start_index += len(start_prefix)
    end_index = text.find(end_suffix, start_index)
    if end_index == -1: return None
    return text[start_index:end_index]
def gaussian_random(mean=0.0, sigma=1.0):
    if use_gaussian_jitter:
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return mean + sigma * z
    else:
        return random.uniform(-sigma, sigma)
def generate_incident_datetime(crime_category):
    day = random.randint(1, 10)
    base_date = datetime.datetime(2026, 3, day)
    weekday = base_date.weekday()
    is_weekend = weekday >= 5  # Sat=5, Sun=6
    hour_mean = random.choice([10.0, 12.0, 14.0, 16.0, 18.0, 20.0])
    hour_sigma = 4.5
    night_prob = night_hotspot_probability
    if crime_specific_time_bias:
        if crime_category in ['Homicide', 'Assault', 'Sexual Assault', 'Family Violence', 'Robbery']:
            if is_weekend:
                hour_mean = random.choice([20.0, 21.0, 22.0, 23.0])
                hour_sigma = 3.5
            else:
                hour_mean = random.choice([18.0, 19.0, 20.0, 21.0])
                hour_sigma = 4.0
        elif crime_category in ['Burglary', 'Stealing of Motor Vehicle']:
            if is_weekend:
                hour_mean = random.choice([12.0, 14.0, 16.0])
            else:
                hour_mean = random.choice([10.0, 13.0, 15.0])
            hour_sigma = 4.0
        elif crime_category == 'Stealing':
            hour_mean = random.choice([11.0, 13.0, 15.0, 17.0])
            hour_sigma = 3.8
        elif crime_category in ['Drug Offences', 'Weapons Offences', 'Weapons Explosives']:
            hour_mean = random.choice([17.0, 19.0, 21.0])
            hour_sigma = 4.5
    if use_time_clustering and random.random() < night_prob and is_weekend:
        hour_mean = random.choice([22.0, 23.0, 0.0, 1.0])
        hour_sigma = 2.0
    hour = int(max(0, min(23, gaussian_random(hour_mean, hour_sigma))))
    minute = random.randint(0, 59)
    incident_date = datetime.datetime(2026, 3, day, hour, minute)
    delay_hours = random.randint(1, 72) if crime_category in ['Sexual Assault', 'Family Violence'] else random.randint(1, 48)
    report_date = incident_date + datetime.timedelta(hours=delay_hours)
    return incident_date, report_date
def compress_int(n):
    if not isinstance(n, int) or n < 0:
        return 'AAAA'
    if n == 0:
        return 'AAAA'
    ret = ''
    base = 36
    temp_n = n
    while temp_n > 0:
        remainder = temp_n % base
        temp_n //= base
        digit = chr(ord('A') + remainder) if remainder < 26 else chr(ord('0') + remainder - 26)
        ret = digit + ret
    return (ret[:4] if len(ret) >= 4 else 'A' * (4 - len(ret)) + ret).upper()
# === DATABASE CONNECTION ===
connection = oracledb.connect(
    config_dir="/home/ubuntu/credentials/fu40",
    user="wapol10",
    password=os.environ["DB_PASSWORD"],
    dsn="fu40_medium",
    wallet_location="/home/ubuntu/credentials/fu40",
    wallet_password=os.environ["WALLET_PASSWORD"]
)
print("Successfully connected to Oracle Database")
# === GENERATE AND INSERT ===
total_incidents =  613
incidents = []
print("Pre-generating all incidents...")
for i in range(total_incidents):
    suburb_index = random.choices(range(len(Suburbs)), weights=listSuburbWeights)[0]
    selected_suburb = Suburbs[suburb_index]
    sigma = selected_suburb.get("jitter", 0.020)
    if random.random() < hotspot_probability:
        hotspot_lat = selected_suburb["Latitude"] + gaussian_random(0, sigma * 1.2)
        hotspot_lon = selected_suburb["Longitude"] + gaussian_random(0, sigma * 1.2)
        work_lat = hotspot_lat + random.uniform(-0.004, 0.004)
        work_lon = hotspot_lon + random.uniform(-0.004, 0.004)
    else:
        work_lat = selected_suburb["Latitude"] + gaussian_random(0, sigma)
        work_lon = selected_suburb["Longitude"] + gaussian_random(0, sigma)
    if not globe.is_land(work_lat, work_lon):
        i -= 1
        continue
    newlocation = geolocator.reverse(f'{work_lat},{work_lon}', timeout=None)
    try:
        localRoad = newlocation.raw['address'].get('road')
        newStreet = f"{random.randint(10, 200)} {localRoad}"
        newSuburb = newlocation.raw['address'].get('suburb', selected_suburb['Suburb']).title()
        newPostcode = newlocation.raw['address'].get('postcode', selected_suburb['Postcode'])
    except:
        localRoad = random.choice(['Main St', 'High St', 'Beach Rd', 'Grand Promenade', 'Alexander Dr'])
        newStreet = f"{random.randint(10, 200)} {localRoad}"
        newSuburb = selected_suburb['Suburb'].title()
        newPostcode = selected_suburb['Postcode']
    crime_index = random.choices(range(len(WACrimes)), weights=listCrimeWeights)[0]
    crime_category = WACrimes[crime_index]["Category"]
    category_colour = crime_colour.get(crime_category, '#000000')
    incident_date, report_date = generate_incident_datetime(crime_category)
    incidents.append({
        'incident_date': incident_date,
        'report_date': report_date,
        'suburb': newSuburb,
        'address': newStreet,
        'postcode': newPostcode,
        'latitude': work_lat,
        'longitude': work_lon,
        'police_district': selected_suburb["Police_District"],
        'crime_category': crime_category,
        'category_colour': category_colour
    })
incidents.sort(key=lambda x: x['incident_date'])
current_sequence = 4793
with connection.cursor() as cursor:
    for idx, inc in enumerate(incidents):
        print(f'Inserting incident {idx+1}/{total_incidents} ({inc["incident_date"]})')
        incident_date = inc['incident_date']
        report_date = inc['report_date']
        created = datetime.datetime.now()
        origin_app = state_short + "POL"
        origin_date = report_date
        incident_date_longform = incident_date.strftime("%d-%b-%Y %H:%M").upper()
        seq_part = current_sequence
        current_sequence += 1
        if current_sequence > 99999:
            current_sequence = 10000
        date_part = incident_date.strftime("%d%m%y")
        time_part = incident_date.strftime("%H%M")
        ir_number = f"{date_part} {time_part} {seq_part:05d}"
        year_last_digit = incident_date.year % 10
        combined_num = int(f"{year_last_digit}{seq_part:05d}")
        ir_code = compress_int(combined_num)
        suspect_gender = random.choices(["Male", "Female"], [0.7, 0.3])[0]
        suspect_name = f"{fake.first_name_male() if suspect_gender == 'Male' else fake.first_name_female()} {fake.last_name()}"
        suspect_age = random.randint(18, 75)
        victim_gender = random.choices(["Male", "Female"], [0.4, 0.6])[0]
        victim_name = f"{fake.first_name_male() if victim_gender == 'Male' else fake.first_name_female()} {fake.last_name()}"
        victim_age = random.randint(16, 90)
        officer_gender = random.choices(["Male", "Female"], [0.6, 0.4])[0]
        officer_name = f"{fake.first_name_male() if officer_gender == 'Male' else fake.first_name_female()} {fake.last_name()}"
        officer_badge_number = state_short + str(random.randint(1000, 9999))
        suspect_photo = 'https://example.com/placeholder.jpg'
        suspect_distinguishing_features = '{}'
        disposition = 'OPEN'
        charges = 'Pending'
        # NEW: Select target risk level (weighted toward lower for diversity)
        risk_levels = random.choices(['low', 'moderate', 'high', 'critical'], weights=[0.4, 0.3, 0.2, 0.1])[0]  # Bias to low/moderate
        risk_prompt = f" Depict the incident as {risk_levels} risk level: for low risk, use words like 'minor', 'resolved', 'concluded', 'calm', 'defused', 'cooperative', 'first time', no harm, no weapons, no threats; for moderate risk, use neutral language with no extremes; for high risk, include 'ongoing', 'serious', 'previous', 'prior', 'threat', 'aggressive', 'repeat'; for critical risk, include 'in progress', 'violent', 'escalating', 'worsening', 'weapon', 'assault on police', immediate danger."
        # Generate full case description with risk guidance
        try:
            chat_request = GenericChatRequest()
            chat_request.messages = [UserMessage(content=[TextContent(text=(
                f"Write one to three concise paragraphs in the style of a Western Australia police officer's initial report for a fictional {inc['crime_category']} incident. "
                f"Include suspect {suspect_name} ({suspect_age}-year-old {suspect_gender}), victim {victim_name} ({victim_age}-year-old {victim_gender}), "
                f"and location {inc['address']}, {inc['suburb']}. Optionally mention a family member or witness. Pick any time, through the day. "
                f"Use formal police language. Do not add greetings, questions, or extra formatting.{risk_prompt}"
            ))])]
            chat_request.temperature = 0.7
            chat_request.top_p = 0.9
            chat_request.max_tokens = 600
            chat_detail = ChatDetails()
            chat_detail.serving_mode = OnDemandServingMode(model_id="meta.llama-4-maverick-17b-128e-instruct-fp8")
            chat_detail.chat_request = chat_request
            chat_detail.compartment_id = compartment_id
            chat_response = generative_ai_inference_client.chat(chat_detail)
            case_description = chat_response.data.chat_response.choices[0].message.content[0].text.strip()
        except Exception as e:
            print(f"Case description error: {e}")
            case_description = f"Incident involving {suspect_name} and {victim_name} reported at {inc['address']}, {inc['suburb']}."
        # Generate short headline for crime_detail (unchanged)
        try:
            headline_request = GenericChatRequest()
            headline_request.messages = [UserMessage(content=[TextContent(text=(
                f"Create a single concise headline (maximum 100 characters) that summarizes the following police incident report. "
                f"Use neutral, factual language similar to a police log or news ticker. "
                f"Do not use quotation marks. Do not add any extra text or formatting.\n\n"
                f"Report: {case_description}"
            ))])]
            headline_request.temperature = 0.5
            headline_request.top_p = 0.85
            headline_request.max_tokens = 60
            headline_detail = ChatDetails()
            headline_detail.serving_mode = OnDemandServingMode(model_id="meta.llama-4-maverick-17b-128e-instruct-fp8")
            headline_detail.chat_request = headline_request
            headline_detail.compartment_id = compartment_id
            headline_response = generative_ai_inference_client.chat(headline_detail)
            crime_detail = headline_response.data.chat_response.choices[0].message.content[0].text.strip()
            if len(crime_detail) > 100:
                crime_detail = crime_detail[:97] + "..."
            crime_detail = crime_detail.strip('"\'')
        except Exception as e:
            print(f"Headline generation failed: {e}")
            crime_detail = f"{inc['crime_category']} incident in {inc['suburb']} involving {suspect_age}-year-old"
            if len(crime_detail) > 100:
                crime_detail = crime_detail[:97] + "..."
        # Generate evidence JSON (unchanged)
        try:
            evidence_request = GenericChatRequest()
            evidence_request.messages = [UserMessage(content=[TextContent(text=(
                f"Output ONLY a valid JSON array of 2-9 fictitious evidence records for the incident on {incident_date_longform}. "
                f"Each record must have keys: evidence_type, source, date_recorded (DD-MON-YYYY), description. "
                f"Optional key: content. Wrap the entire JSON in ```json markers and output nothing else. "
                f"Case narrative: {case_description}"
            ))])]
            evidence_request.temperature = 0.5
            evidence_request.max_tokens = 1500
            evidence_detail = ChatDetails()
            evidence_detail.serving_mode = OnDemandServingMode(model_id="meta.llama-4-maverick-17b-128e-instruct-fp8")
            evidence_detail.chat_request = evidence_request
            evidence_detail.compartment_id = compartment_id
            evidence_response = generative_ai_inference_client.chat(evidence_detail)
            evidence_raw = evidence_response.data.chat_response.choices[0].message.content[0].text
            evidence = extract_between_string_methods(evidence_raw, "```json", "```")
            if evidence is None:
                evidence = evidence_raw.strip()
        except Exception as e:
            print(f"Evidence generation error: {e}")
            evidence = "[]"
        # Insert into database
        cursor.execute(crime_insert_sql, [
            report_date, incident_date, inc['suburb'], inc['address'], inc['postcode'],
            state_short, inc['crime_category'], inc['category_colour'], crime_detail, case_description,
            inc['latitude'], inc['longitude'], victim_name, victim_age, victim_gender,
            suspect_name, suspect_age, suspect_gender, suspect_photo, suspect_distinguishing_features,
            officer_name, officer_badge_number, charges, disposition, evidence,
            inc['police_district'], origin_app, origin_date, created, ir_number, ir_code
        ])
        connection.commit()
print("Synthetic crime incident generation complete – 613 realistic WA incidents inserted.")