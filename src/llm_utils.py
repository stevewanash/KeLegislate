from openai import OpenAI
import re
import streamlit as st
from hustle_profiles import INDUSTRIES


def _get_client():
    """Configure and return the DeepSeek client (OpenAI-compatible). Centralizes API key handling."""
    try:
        api_key = st.secrets["DEEPSEEK_API_KEY"]
    except KeyError:
        return None, "Error: DEEPSEEK_API_KEY not found in Streamlit secrets."

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com"
    )
    return client, None


def _chat(client, prompt, temperature=1.0):
    """Single helper to call DeepSeek chat completions and return text."""
    response = client.chat.completions.create(
        model="deepseek-v4-flash",
        messages=[
            {"role": "system", "content": "You are an expert policy analyst for Kenyan legislation."},
            {"role": "user", "content": prompt}
        ],
        temperature=temperature,
        stream=False
    )
    return response.choices[0].message.content


# Build the industry list string once for use in prompts
_INDUSTRY_LIST_STR = "\n".join(f"- {ind}" for ind in INDUSTRIES)


@st.cache_data(ttl='90d', max_entries=50, show_spinner=False)
def summarize_bill(bill_text):
    """
    Sends bill text to DeepSeek for summarization, extraction, and auto-tagging.
    Appends an Industry Tags section using the canonical taxonomy (W7).
    """
    client, error = _get_client()
    if error:
        return error

    if not bill_text or len(bill_text) < 100:
        return "Error: Bill text was empty or unreadable."

    prompt = f"""
    You are an expert policy analyst. Summarize the following Kenyan legislative bill text into simple English and simple Swahili.
    Avoid complex legal jargon.

    Structure the output exactly as follows:
    
    ## Simple English Summary
    [Write summary here]

    ## 1. Key Implications for Citizens
    * [Point 1]
    * [Point 2]
    * [upto 5 points allowed]

    ## 2. Key Implications for Businesses/Government
    * [Point 1]
    * [Point 2]
    * [upto 5 points allowed]

    ---

    ## Muhtasari
    [Toa muhtasari hapa.]

    ## 1. Athari kwa Wananchi
    * [Athari 1]
    * [Athari 2]
    * [Idadi inaweza fika 5]
    
    ## 2. Athari kwa Biashara/Serikali
    * [Athari 1]
    * [Athari 2]
    * [Idadi inaweza fika 5]

    ---

    ## Industry Tags
    From the following list, select ALL industries that this bill directly impacts.
    Return ONLY tags from this exact list, one per line, prefixed with "- ":
{_INDUSTRY_LIST_STR}

    ---

    Bill Text:
    {bill_text[:30000]}
    """

    try:
        return _chat(client, prompt)
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            return (
                "**AI Service Temporarily Unavailable**\n\n"
                "We've hit the usage limit for the AI service. "
                "Please try again later."
            )
        return f"**Unexpected AI Error:** {e}"


def parse_tags_from_summary(summary_text):
    """
    Extracts industry tags from the '## Industry Tags' section of the AI summary.
    Returns a list of matched canonical tags. Unrecognized tags are silently dropped
    to ensure only taxonomy-valid tags are stored (W7).
    """
    tags = []

    # Find the Industry Tags section
    match = re.search(r'## Industry Tags\s*\n(.*?)(?:\n---|\n##|\Z)', summary_text, re.DOTALL)
    if not match:
        return tags

    tags_section = match.group(1)

    # Extract each "- Tag Name" line
    for line in tags_section.strip().split('\n'):
        line = line.strip()
        if line.startswith('- '):
            tag = line[2:].strip()
            # Only accept tags from the canonical list
            if tag in INDUSTRIES:
                tags.append(tag)

    return tags


@st.cache_data(ttl='90d', max_entries=50, show_spinner=False)
def generate_impact_analysis(ai_summary, tags, profile_name, operational_metrics):
    """
    Generates a personalized KES-denominated financial impact analysis.
    Uses the CACHED AI summary (not raw bill text) to save tokens (W3).
    """
    client, error = _get_client()
    if error:
        return error

    # Build the metrics string dynamically based on available fields
    metrics_lines = []
    if 'vehicle_value_kes' in operational_metrics:
        metrics_lines.append(f"- Vehicle type/value: KES {operational_metrics['vehicle_value_kes']:,}")
    metrics_lines.append(f"- Estimated monthly revenue: KES {operational_metrics['est_monthly_revenue_kes']:,}")
    metrics_lines.append(f"- Estimated monthly overhead: KES {operational_metrics['est_monthly_overhead_kes']:,}")
    if 'insurance_annual_kes' in operational_metrics:
        metrics_lines.append(f"- Current insurance cost: KES {operational_metrics['insurance_annual_kes']:,} per year")
    if 'num_employees' in operational_metrics:
        metrics_lines.append(f"- Number of employees: {operational_metrics['num_employees']}")
    metrics_lines.append(f"- Key expense categories: {', '.join(operational_metrics.get('expense_categories', []))}")
    if 'registered_business' in operational_metrics:
        metrics_lines.append(f"- Registered business: {'Yes' if operational_metrics['registered_business'] else 'No'}")

    metrics_str = "\n".join(metrics_lines)

    prompt = f"""
You are a Kenyan financial analyst specializing in the informal sector.
A user is a {profile_name}.

Their operational profile:
{metrics_str}

The following bill has been proposed:
{ai_summary}

Produce the following analysis in clear, simple language that an informal worker would understand:

## Financial Impact (KES)
A markdown table with columns: Impact Area | Current (KES/month) | Projected Change | New Amount (KES/month)
Include rows for: Insurance/levies, Tax obligations, Licensing/permits, Operating costs
Calculate actual KES figures based on the profile metrics above.

## Net Monthly Impact
Total additional cost or saving in KES per month, and as a percentage of monthly revenue.
Express this in relatable terms (e.g., "This is equivalent to X days of lost revenue").

## Compliance Checklist
Numbered list of specific actions this business owner must take if the bill passes.
Be practical and specific — include deadlines, offices to visit, or documents needed where applicable.

## Risk Level
Rate as LOW / MEDIUM / HIGH with a one-sentence justification.
"""

    try:
        return _chat(client, prompt, temperature=0.7)
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            return (
                "**AI Service Temporarily Unavailable**\n\n"
                "We've hit the usage limit for the AI service. "
                "Please try again later."
            )
        return f"**AI Analysis Error:** {e}"


@st.cache_data(ttl='1h', max_entries=10, show_spinner=False)
def generate_insights(feedback_text):
    """
    Analyzes aggregated citizen feedback.
    """
    client, error = _get_client()
    if error:
        return error

    prompt = f"""
    Analyze the following citizen feedback regarding a legislative bill:
    {feedback_text}

    Produce:
    1. Overall sentiment analysis (approximate % support vs opposition).
    2. Top 5 specific citizen concerns.
    3. Suggested improvements for policymakers based on this data.
    4. A 3-5 bullet executive summary for decision-makers.
    """

    try:
        return _chat(client, prompt)
    except Exception as e:
        return f"AI Analysis Error: {e}"