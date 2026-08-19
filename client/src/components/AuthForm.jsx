import { useState } from "react";

export default function AuthForm({ mode, onSubmit, loading }) {
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const change = (event) =>
    setValues({ ...values, [event.target.name]: event.target.value });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {mode === "register" && (
        <input
          name="name"
          placeholder="Name"
          value={values.name}
          onChange={change}
          required
        />
      )}
      <input
        name="email"
        type="email"
        placeholder="Email"
        value={values.email}
        onChange={change}
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        value={values.password}
        onChange={change}
        required
      />
      <button disabled={loading}>
        {loading
          ? "Please wait"
          : mode === "login"
            ? "Login"
            : "Create account"}
      </button>
    </form>
  );
}
