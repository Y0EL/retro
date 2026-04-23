from . import mx_check, regex_check, dns_a_check

validate_email_mx        = mx_check.validate_email
validate_email_regex     = regex_check.validate_email
extract_emails_from_text = regex_check.extract_emails

def validate_contact(email=None, domain=None) -> dict:
    result = {}
    if email:
        try:    result["email_check"] = mx_check.validate_email(email)
        except: result["email_check"] = regex_check.validate_email(email)
    if domain:
        result["domain_check"] = mx_check.fetch(domain)
    return result
