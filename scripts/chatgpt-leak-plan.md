# BLOG: /news/chatgpt-data-leakage-flaw-check-point
# VIDEO: public/videos/chatgpt-leak-reels.mp4

# FIXED HEADLINE: ChatGPT Data Leak Flaw Exposed Conversations
# SOURCE TEXT: CHECK POINT RESEARCH - March 30, 2026

# 16 segments - each with fear angle for ChatGPT users

SEGMENTS = [
    ("Data leaked", "A critical flaw in ChatGPT allowed attackers to silently leak your conversations without any warning."),
    ("Check Point", "Check Point Research discovered a vulnerability that turned ChatGPT into a covert data exfiltration channel."),
    ("DNS tunnel", "The attack used DNS tunneling, a hidden side channel that bypassed all ChatGPT security guardrails."),
    ("No consent", "No alerts were triggered. No permission dialogs appeared. Your data left silently without permission."),
    ("Single prompt", "Just one malicious prompt was enough to activate the leak. After that, everything you typed was at risk."),
    ("Custom GPTs", "Attackers could weaponize custom GPTs. You would interact normally while your data was stolen."),
    ("Remote access", "The same technique enabled remote command execution inside ChatGPT's Linux runtime environment."),
    ("Uploads exposed", "Financial records, medical documents, and contracts you uploaded could be silently transmitted out."),
    ("AI summaries", "Even AI generated summaries of your data were extracted, often more sensitive than the original files."),
    ("No detection", "ChatGPT itself did not recognize the behavior as risky. The platform could not detect the leak."),
    ("False trust", "The assistant continued responding normally while your data was being stolen in the background."),
    ("GDPR risk", "For businesses, a ChatGPT breach means GDPR violations, HIPAA exposure, and compliance failures."),
    ("Enterprises exposed", "Customer data, strategy documents, and internal materials were all at risk of exposure."),
    ("Fixed February", "OpenAI fixed the vulnerability on February 20, 2026, but the lesson remains for all users."),
    ("Not secure by default", "AI tools should not be assumed secure by default. Independent security is essential."),
    ("NotOpen protects", "NotOpen encrypts your conversations end to end. No DNS tunnel can leak what is already encrypted."),
]

# Images needed (16 total, prefix p, NONE from previous videos):
# p1: ChatGPT interface / AI chat (fear angle)
# p2: Security research / code analysis  
# p3: Network / DNS / data flow
# p4: Warning / danger sign
# p5: Malicious code / single prompt
# p6: Custom GPT / bot concept
# p7: Remote access / hacker control
# p8: Documents / upload concept
# p9: AI / data processing
# p10: Hidden / stealth concept
# p11: False trust / fake security
# p12: GDPR / legal documents
# p13: Enterprise / corporate data
# p14: Calendar / timeline (February fix)
# p15: Broken shield / vulnerable
# p16: Encryption / privacy
