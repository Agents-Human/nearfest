const Alert = (handleAlert:any, details:any) => {
  const { status, title, message, type } = details;
  const closeAlert = () => {
    let x = Object.assign({}, details);
    x.status = false;
    handleAlert(x);
  };
  return (
    <div className={`vr-alert ${type} ${status == true && "active"}`}>
      <div className="alert-content">
        <b>{title}</b>
        <span>{message}</span>
      </div>
      <a onClick={closeAlert}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
        >
          <path fill="none" d="M0 0h24v24H0z" />
          <path
            d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z"
            fill="rgba(255,255,255,1)"
          />
        </svg>
      </a>
    </div>
  );
};
export default Alert;
