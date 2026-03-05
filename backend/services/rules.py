def evaluate_patient(v):

    if v.surgery == "appendectomy":
        if v.bp_sys > 90 and v.spo2 > 94 and v.temperature < 38.5:
            return {"status": "READY"}
        else:
            return {"status": "NOT READY"}

    elif v.surgery == "cataract":
        if v.bp_sys < 160 and v.blood_sugar < 200 and v.spo2 > 94:
            return {"status": "READY"}
        else:
            return {"status": "DELAY"}

    elif v.surgery == "cabg":
        if v.hemoglobin > 10 and v.spo2 > 95:
            return {"status": "HIGH RISK"}
        else:
            return {"status": "NOT READY"}

    return {"status": "UNKNOWN SURGERY"}