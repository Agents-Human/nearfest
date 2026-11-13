import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import { Formik, ErrorMessage } from "formik";
import * as yup from "yup";
import Alert from "./Alert";
// Donate Art
const schema = yup.object().shape({
  marketplace: yup.string().required("Marketplace is required"),
  objkt: yup.string().required("Objkt is required"),
  editions: yup.string().required("Editions is required"),
});
const DonateArt = (core:any) => {
  var initial = {
    status: false,
    type: "info",
    title: "Donate Art",
    message: "",
  };
  const [msg, setAlert] = useState(initial);
  const submit = async (core:any, values:any) => {
    const x = await core.donate_token(values.marketplace, values.editions)
    if (x === 'success') {
      const m = {
        status: true,
        type: "success",
        title: "Donate Art",
        message: "Art donated successfully",
      };
      setAlert(m);
    } else {
      const m = {
        status: true,
        type: "error",
        title: "Donate Art",
        message: "Failed to donate art",
      };
      setAlert(m);
    }
  };
  const handleAlert = (status:any) => {
    setAlert(status);
  };
  return (
    <div>
      <Alert handleAlert={handleAlert} details={msg} />
      <Formik
        validationSchema={schema}
        onSubmit={console.log}
        initialValues={{
          marketplace: "",
          objkt: "",
          editions: "",
        }}
      >
        {({
          handleSubmit,
          handleChange,
          handleBlur,
          values,
          touched,
          isValid,
          errors,
        }) => (
          <Form noValidate onSubmit={handleSubmit}>
            <Form.Group controlId="validationFormikMarketplace">
              <Form.Select
                aria-label="marketplace"
                name="marketplace"
                value={values.marketplace}
                onChange={handleChange}
                isInvalid={!!errors.marketplace}
              >
                {core.wallet_tokens && core.wallet_tokens.map((x:any, i:any) => {
                  const pretty =
                    x.name +
                    " (token_id = " +
                    x.token_id.toString() +
                    ", balance = " +
                    x.balance.toString() +
                    ")";
                  return (
                    <option key={i} className="options-color" value={i}>
                      {pretty}
                    </option>
                  );
                })}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.marketplace}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group controlId="validationFormikEditions">
              <Form.Control
                type="text"
                placeholder="Editions:"
                name="editions"
                value={values.editions}
                onChange={handleChange}
                isInvalid={!!errors.editions}
              />

              <Form.Control.Feedback type="invalid">
                {errors.editions}
              </Form.Control.Feedback>
            </Form.Group>
            <button type="submit" onClick={async () => submit(core, values)}>
              Donate
            </button>
          </Form>
        )}
      </Formik>
      <br/>
      <p className="tk-tablet-gothic"><b>Trouble with UI?</b> Donations can always be sent to the vending machine wallet at:
        <br/>
        <span className="text-primary donation-blurb">VENDINGNFTS.TEZ OR (tz1LwtYtbchiga4rYFy6P3BFaKn44ptEjdjm)</span>
      </p>
    </div>
  );
};
export default DonateArt;
