import streamlit as st
import pandas as pd
import plotly.express as px
from wordcloud import WordCloud
import matplotlib.pyplot as plt

# Import custom modules
import scraper
import pdf_utils
import llm_utils
import feedback_utils
import sms_utils
import shutil
import platform
from hustle_profiles import INDUSTRIES, HUSTLE_PROFILES

# Page Config
st.set_page_config(page_title="KeLegislate AI", layout="wide")

# --- Session State Management ---
if 'bills' not in st.session_state:
    st.session_state['bills'] = []
if 'current_bill_text' not in st.session_state:
    st.session_state['current_bill_text'] = ""
if 'current_summary' not in st.session_state:
    st.session_state['current_summary'] = ""
if 'impact_result' not in st.session_state:
    st.session_state['impact_result'] = ""
if 'subscription_status' not in st.session_state:
    st.session_state['subscription_status'] = None  # None | 'success' | 'error'
if 'cached_bills' not in st.session_state:
    st.session_state['cached_bills'] = []

# --- Main Layout ---
st.title("🇰🇪 AI Legislative Summarizer & Citizen Voice")
st.markdown("Empowering Kenyan citizens with AI-driven bill analysis and feedback.")

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["📄 Select & Summarize", "🗳️ Give Feedback", "📊 Insights Dashboard", "💼 My Hustle Impact"])

# ==========================================
# TAB 1: Bill Scraper & Summarizer
# ==========================================
with tab1:
    st.header("Find and Analyze Bills")
    
    if st.button("🔄 Refresh Bill List from Parliament.go.ke"):
        with st.spinner("Retrieving latest bills"):
            st.session_state['bills'] = scraper.get_bills()
            if not st.session_state['bills']:
                st.error("Could not find bills. The website structure might have changed.")
            else:
                st.success(f"Found {len(st.session_state['bills'])} bills.")

    # Dropdown
    bill_options = {b['title']: b['url'] for b in st.session_state['bills']}
    selected_bill_title = st.selectbox("Select a Bill", options=list(bill_options.keys()) if bill_options else [])
    
    if selected_bill_title:
        st.caption(f"Source: {bill_options[selected_bill_title]}")
        
        if st.button("🚀 Generate AI Summary"):        
            url = bill_options[selected_bill_title]
            
            # --- Cache Check (W1/W3): Try Firestore first ---
            cached_bill = feedback_utils.get_bill(url)
            
            if cached_bill and cached_bill.get('ai_summary'):
                # Bill already processed — load from cache
                st.session_state['current_bill_text'] = cached_bill.get('extracted_text', '')
                st.session_state['current_summary'] = cached_bill['ai_summary']
                st.info("📦 **Loaded from cache** — This bill was previously analyzed and saved.")
            else:
                # Not cached — run full pipeline
                with st.status("Processing Bill", expanded=True) as status:
                    st.write("Preparing document and running analysis")

                    text = pdf_utils.download_and_extract_text_v2(url)
                    st.session_state['current_bill_text'] = text

                    if "Error:" in text:
                        st.error("PDF Text Extraction Failed. Try again later")
                        status.update(label="Document processing failed", state="error", expanded=True)
                        st.stop()
                    
                    st.write("🤖 Running AI analysis")
                    summary = llm_utils.summarize_bill(text)
                    st.session_state['current_summary'] = summary

                    if "Service Temporarily Unavailable" in summary:
                        status.update(label="AI Service Failed", state="error", expanded=True)
                    else:
                        # --- Auto-save to Firestore (W1) ---
                        tags = llm_utils.parse_tags_from_summary(summary)
                        feedback_utils.save_bill(
                            bill_title=selected_bill_title,
                            bill_url=url,
                            extracted_text=text,
                            ai_summary=summary,
                            tags=tags
                        )
                        status.update(label="Complete! (Saved to database)", state="complete", expanded=False)

    # Display Result
    if st.session_state['current_summary']:
        st.divider()
        st.markdown(st.session_state['current_summary'])

# ==========================================
# TAB 2: Citizen Feedback Form
# ==========================================
with tab2:
    st.header("Citizen Feedback Form")
    
    if not selected_bill_title:
        st.warning("Please select a bill in Tab 1 first.")
    else:
        st.subheader(f"Feedback for: {selected_bill_title}")
        
        with st.form("feedback_form"):
            col1, col2 = st.columns(2)
            with col1:
                support = st.radio("Do you support this bill?", ["Yes", "No", "Not Sure"])
            with col2:
                rating = st.slider("Perceived Benefit (1-5)", 1, 5, 3)
            
            concerns = st.text_area("What are your concerns or suggestions?")
            
            submitted = st.form_submit_button("Submit Feedback")
            
            if submitted:
                with st.spinner("Saving to database"):
                    success = feedback_utils.save_feedback(selected_bill_title, support, rating, concerns)
                    if success:
                        st.success("Thank you! Your voice has been recorded.")
                    else:
                        st.error("Failed to save. Check Firebase configuration.")

# ==========================================
# TAB 3: Insights Dashboard
# ==========================================
with tab3:
    st.header("Public Sentiment Dashboard")
    
    # Load Data
    if not selected_bill_title:
        st.info("Select a bill in Tab 1 to see specific insights, or view global stats below.")
        feedback_data = feedback_utils.fetch_feedback() # Fetch all
    else:
        st.subheader(f"Data for: {selected_bill_title}")
        feedback_data = feedback_utils.fetch_feedback(selected_bill_title)
    
    if not feedback_data:
        st.write("No feedback data available yet.")
    else:
        df = pd.DataFrame(feedback_data)
        
        # 1. Metrics
        col1, col2, col3 = st.columns(3)
        col1.metric("Total Responses", len(df))
        col2.metric("Avg. Benefit Rating", f"{df['rating'].mean():.2f}/5")
        
        # Calculate Support %
        if not df.empty and 'support' in df.columns:
            support_pct = (df['support'] == 'Yes').mean() * 100
            col3.metric("Support Level", f"{support_pct:.1f}%")

        st.divider()

        # 2. Charts
        c1, c2 = st.columns(2)
        
        with c1:
            st.subheader("Support Distribution")
            fig_pie = px.pie(df, names='support', title='Support vs Opposition', hole=0.4)
            st.plotly_chart(fig_pie, use_container_width=True)
            
        with c2:
            st.subheader("Rating Distribution")
            fig_bar = px.bar(df['rating'].value_counts().reset_index(), x='rating', y='count', labels={'rating': 'Rating (1-5)'})
            st.plotly_chart(fig_bar, use_container_width=True)

        # 3. Word Cloud
        st.subheader("Common Concerns (Word Cloud)")
        text_concerns = " ".join(df['concerns'].dropna().tolist())
        if text_concerns:
            wordcloud = WordCloud(width=800, height=400, background_color='white').generate(text_concerns)
            fig, ax = plt.subplots()
            ax.imshow(wordcloud, interpolation='bilinear')
            ax.axis('off')
            st.pyplot(fig)

        # 4. AI Insights
        st.divider()
        st.subheader("🤖 AI-Generated Policy Insights")
        
        if st.button("Generate AI Insights Report"):
            # Prepare a string summary of data for the LLM
            data_summary = f"Total feedback count: {len(df)}\n"
            data_summary += f"Support counts: {df['support'].value_counts().to_dict()}\n"
            data_summary += f"Sample citizen comments: {text_concerns[:4000]}" # Truncate for context limit
            
            with st.spinner("Analyzing feedback patterns"):
                insight_report = llm_utils.generate_insights(data_summary)
                st.markdown(insight_report)

# ==========================================
# TAB 4: My Hustle Impact
# ==========================================
with tab4:
    st.header("💼 My Hustle Impact")
    st.markdown("See exactly how a proposed bill affects **your** business — in shillings and cents.")

    # --- Step 1: Bill Selector (from cached bills in Firestore) ---
    cached_bills = feedback_utils.get_all_bills()
    
    # Also include any bill selected in Tab 1 that might not be cached yet
    all_bill_options = {}
    for b in cached_bills:
        all_bill_options[b['bill_title']] = b
    
    if not all_bill_options:
        st.info("⚠️ No bills have been analyzed yet. Go to **Tab 1** to generate an AI summary for a bill first — it will then appear here.")
        st.stop()
    
    impact_bill_title = st.selectbox(
        "Select a bill to analyze",
        options=list(all_bill_options.keys()),
        key="impact_bill_selector"
    )
    
    if impact_bill_title:
        selected_bill_data = all_bill_options[impact_bill_title]
        bill_tags = selected_bill_data.get('tags', [])
        
        if bill_tags:
            st.caption(f"🏷️ Industries affected: {', '.join(bill_tags)}")
        
        st.divider()

        # --- Step 2: Industry Dropdown ---
        # Show industries that have profiles defined
        available_industries = [ind for ind in INDUSTRIES if ind in HUSTLE_PROFILES]
        
        if not available_industries:
            st.warning("No hustle profiles have been configured yet.")
            st.stop()
        
        selected_industry = st.selectbox(
            "🏭 What industry is your hustle in?",
            options=available_industries,
            key="industry_selector"
        )

        # --- Step 3: Business Profile (Tier) Dropdown ---
        if selected_industry:
            profiles = HUSTLE_PROFILES[selected_industry]
            profile_options = {p['tier']: p for p in profiles}
            
            selected_tier = st.selectbox(
                "📊 Select the profile closest to your business",
                options=list(profile_options.keys()),
                key="profile_selector"
            )

            if selected_tier:
                profile = profile_options[selected_tier]
                
                # Show profile preview
                with st.expander("📋 Your business profile (click to review)", expanded=True):
                    st.markdown(f"**{profile['tier']}**")
                    st.markdown(f"_{profile['description']}_")
                    
                    metrics = profile['metrics']
                    col1, col2, col3 = st.columns(3)
                    
                    if 'vehicle_value_kes' in metrics:
                        col1.metric("Vehicle Value", f"KES {metrics['vehicle_value_kes']:,}")
                    col2.metric("Est. Monthly Revenue", f"KES {metrics['est_monthly_revenue_kes']:,}")
                    col3.metric("Est. Monthly Overhead", f"KES {metrics['est_monthly_overhead_kes']:,}")
                    
                    if 'insurance_annual_kes' in metrics:
                        st.caption(f"📋 Annual insurance: KES {metrics['insurance_annual_kes']:,}")
                    st.caption(f"📋 Key expenses: {', '.join(metrics.get('expense_categories', []))}")

                st.divider()

                # --- Step 4: Subscription Form (opt-in alerts) ---
                st.subheader("📲 Get Future Bill Alerts")
                st.markdown("Opt in to receive an SMS whenever a new bill affects your hustle.")

                opt_in = st.checkbox(
                    "✅ Yes, I want to receive future bill alerts via SMS",
                    key="opt_in_checkbox"
                )

                if opt_in:
                    with st.form("subscription_form"):
                        phone_input = st.text_input(
                            "📱 Phone Number",
                            placeholder="e.g. 0712345678 or +254712345678",
                            key="phone_input"
                        )

                        language_pref = st.selectbox(
                            "🌐 Preferred Alert Language",
                            options=["English", "Swahili"],
                            key="language_pref"
                        )

                        subscribe_btn = st.form_submit_button(
                            "📩 Subscribe & Send Me This Alert"
                        )

                        if subscribe_btn:
                            if not phone_input.strip():
                                st.error("Please enter your phone number.")
                            else:
                                # Validate & normalise phone number (W8)
                                normalized = sms_utils.normalize_phone(phone_input)
                                if not normalized:
                                    st.error(
                                        f"❌ '{phone_input}' doesn't look like a valid Kenyan number. "
                                        "Try formats like 0712345678 or +254712345678."
                                    )
                                else:
                                    # 1. Save subscriber to Firestore
                                    saved = feedback_utils.save_subscriber(
                                        phone_number=normalized,
                                        industry_tag=selected_industry,
                                        profile_tier=selected_tier,
                                        operational_metrics=metrics,
                                        preferred_language=language_pref
                                    )

                                    if not saved:
                                        st.error("Failed to save your subscription. Check Firebase configuration.")
                                    else:
                                        # 2. Build a brief impact snippet for the SMS
                                        # Use the cached impact result if available, else a generic message
                                        if st.session_state['impact_result']:
                                            # Extract just the Net Monthly Impact section for SMS brevity
                                            import re as _re
                                            snippet_match = _re.search(
                                                r'## Net Monthly Impact\s*\n(.*?)(?:\n##|\Z)',
                                                st.session_state['impact_result'],
                                                _re.DOTALL
                                            )
                                            impact_snippet = (
                                                snippet_match.group(1).strip()
                                                if snippet_match
                                                else st.session_state['impact_result'][:300]
                                            )
                                        else:
                                            impact_snippet = (
                                                f"A new bill ({impact_bill_title}) may affect your "
                                                f"{selected_industry} business. Open KeLegislate "
                                                "for your full financial impact breakdown."
                                            )

                                        # 3. Send immediate SMS alert
                                        with st.spinner("📡 Sending your SMS alert..."):
                                            sms_result = sms_utils.send_impact_alert(
                                                phone_number=normalized,
                                                bill_title=impact_bill_title,
                                                impact_snippet=impact_snippet,
                                                language=language_pref
                                            )

                                        if sms_result["success"]:
                                            st.session_state['subscription_status'] = 'success'
                                            st.success(
                                                f"✅ Subscribed! An SMS alert has been sent to {normalized}. "
                                                "You'll receive future alerts for bills affecting "
                                                f"**{selected_industry}**."
                                            )
                                        else:
                                            st.session_state['subscription_status'] = 'error'
                                            st.warning(
                                                f"✅ Subscribed to future alerts, but the immediate SMS "
                                                f"could not be sent: {sms_result['message']}"
                                            )

                # Show persistent subscription status after form reruns
                if st.session_state['subscription_status'] == 'success':
                    st.info("💬 You are subscribed to SMS alerts for this industry.")

                st.divider()

                # --- Step 5: Generate Impact Summary ---
                if st.button("🚀 Generate Impact Summary", key="generate_impact_btn"):
                    ai_summary = selected_bill_data.get('ai_summary', '')

                    if not ai_summary:
                        st.error("This bill hasn't been summarized yet. Please generate an AI summary in Tab 1 first.")
                    else:
                        with st.spinner("🤖 Calculating financial impact on your hustle..."):
                            impact = llm_utils.generate_impact_analysis(
                                ai_summary=ai_summary,
                                tags=bill_tags,
                                profile_name=profile['tier'],
                                operational_metrics=metrics
                            )
                            st.session_state['impact_result'] = impact

                # --- Step 6: Display Impact Results ---
                if st.session_state['impact_result']:
                    st.divider()
                    st.subheader("📈 Impact Analysis Results")
                    st.markdown(st.session_state['impact_result'])